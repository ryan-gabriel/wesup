import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as login } from "@/app/api/auth/login/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

function postJson(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

interface LoginClientOptions {
  authUser?: { id: string; email?: string } | null;
  signInError?: { message: string } | null;
  profile?: { role: string; status: string; full_name: string } | null;
  profileError?: Error | null;
  supplierVerification?: "pending" | "approved" | "rejected" | null;
  supplierProfileError?: Error | null;
}

function mockLoginClient(options: LoginClientOptions = {}) {
  const authUser = options.authUser ?? { id: "u-1", email: "buyer@example.com" };
  const signInWithPassword = vi.fn(async () => ({
    data: { user: options.signInError === undefined ? authUser : null },
    error: options.signInError ?? null,
  }));
  const getUser = vi.fn(async () => ({
    data: { user: authUser },
    error: null,
  }));
  const signOut = vi.fn(async () => ({ error: null }));
  const profileSingle = vi.fn(async () =>
    options.profileError
      ? { data: null, error: options.profileError }
      : { data: options.profile ?? null, error: null },
  );
  const supplierMaybeSingle = vi.fn(async () =>
    options.supplierProfileError
      ? { data: null, error: options.supplierProfileError }
      : {
          data:
            options.supplierVerification === undefined
              ? null
              : { verification_status: options.supplierVerification },
          error: null,
        },
  );
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: profileSingle })),
        })),
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: supplierMaybeSingle })),
      })),
    };
  });
  const auth = { signInWithPassword, getUser, signOut };
  const client = { auth, from };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { auth, supplierMaybeSingle };
}

describe("POST /api/auth/login role-aware contract", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    const { auth } = mockLoginClient();
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "rate_limited" }, { status: 429 }),
    );
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "password123",
      role: "umkm",
    }));
    expect(res.status).toBe(429);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns the signed-in user and active profile", async () => {
    const { auth } = mockLoginClient({
      profile: { role: "umkm", status: "active", full_name: "Budi UMKM" },
    });
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "password123",
      role: "umkm",
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { email: "buyer@example.com" },
      profile: { role: "umkm", status: "active", fullName: "Budi UMKM" },
      redirectTo: "/marketplace",
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "buyer@example.com",
      password: "password123",
    });
  });

  it("returns 400 without calling Auth when role is missing", async () => {
    const { auth } = mockLoginClient();
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "password123",
    }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Periksa kembali data login Anda.",
      fieldErrors: { role: "Pilih jenis akun untuk login." },
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns a generic error for invalid credentials", async () => {
    const { auth } = mockLoginClient({
      authUser: null,
      signInError: { message: "Invalid login credentials" },
    });
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "wrong-password",
      role: "umkm",
    }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      code: "invalid_credentials",
      error: "Email atau password salah.",
    });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("signs out when the profile cannot be loaded", async () => {
    const { auth } = mockLoginClient({ profileError: new Error("profile unavailable") });
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "password123",
      role: "umkm",
    }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      code: "profile_unavailable",
      error: "Profil akun belum dapat dimuat. Coba lagi.",
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["suspended_temporary", "Akun Anda sedang ditangguhkan sementara."],
    ["suspended_permanent", "Akun Anda ditangguhkan permanen. Hubungi Admin Wesup."],
    ["banned", "Akun Anda diblokir. Hubungi Admin Wesup."],
  ] as const)("rejects %s accounts and signs out", async (status, message) => {
    const { auth } = mockLoginClient({
      profile: { role: "umkm", status, full_name: "Blocked User" },
    });
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "password123",
      role: "umkm",
    }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: "inactive_account",
      error: message,
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("rejects a role mismatch and signs out", async () => {
    const { auth } = mockLoginClient({
      profile: { role: "umkm", status: "active", full_name: "Budi UMKM" },
    });
    const res = await login(postJson({
      email: "buyer@example.com",
      password: "password123",
      role: "admin",
    }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: "role_mismatch",
      error: "Akun ini tidak terdaftar sebagai Admin.",
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("rejects a pending supplier application without granting supplier role", async () => {
    const { auth, supplierMaybeSingle } = mockLoginClient({
      profile: { role: "umkm", status: "active", full_name: "Budi Supplier" },
      supplierVerification: "pending",
    });
    const res = await login(postJson({
      email: "supplier@example.com",
      password: "password123",
      role: "supplier",
    }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: "supplier_pending",
      error: "Pendaftaran pemasok Anda masih menunggu verifikasi Admin.",
    });
    expect(supplierMaybeSingle).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("rejects a rejected supplier application", async () => {
    const { auth } = mockLoginClient({
      profile: { role: "umkm", status: "active", full_name: "Budi Supplier" },
      supplierVerification: "rejected",
    });
    const res = await login(postJson({
      email: "supplier@example.com",
      password: "password123",
      role: "supplier",
    }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: "supplier_rejected",
      error: "Pendaftaran pemasok Anda belum disetujui. Hubungi Admin Wesup.",
    });
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("allows an approved supplier whose profile role is supplier", async () => {
    const { auth, supplierMaybeSingle } = mockLoginClient({
      profile: { role: "supplier", status: "active", full_name: "Sari Supplier" },
    });
    const res = await login(postJson({
      email: "supplier@example.com",
      password: "password123",
      role: "supplier",
    }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      user: { email: "buyer@example.com" },
      profile: { role: "supplier", status: "active", fullName: "Sari Supplier" },
      redirectTo: "/supplier",
    });
    expect(supplierMaybeSingle).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
