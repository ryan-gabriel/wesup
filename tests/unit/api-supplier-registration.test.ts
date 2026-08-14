import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as registerSupplier } from "@/app/api/auth/register/supplier/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

function postJson(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validSupplierPayload = {
  email: "supplier.bandung@example.com",
  password: "password123",
  full_name: "Asep Sunandar",
  phone: "081234567890",
  business_name: "Tahu Sumedang Lembang",
  address: "Jl. Raya Lembang No. 123, Bandung",
  latitude: -6.8188,
  longitude: 107.6186,
  nik: "3204123456780001",
  ktp_photo_url: "https://storage.wesup.id/wesup-assets/ktp/asep_ktp.webp",
  business_photo_url: "https://storage.wesup.id/wesup-assets/business/asep_store.webp",
  location_consent: true,
};

describe("POST /api/auth/register/supplier", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGetServerClient.mockReset();
  });

  it("successfully registers a supplier with valid data, Bandung coordinates, and consent", async () => {
    const mockUser = { id: "sup-user-uuid-1", email: validSupplierPayload.email };
    const signUpMock = vi.fn(async () => ({
      data: { user: mockUser },
      error: null,
    }));

    const insertMock = vi.fn(async () => ({
      data: null,
      error: null,
    }));

    const fromMock = vi.fn((table: string) => {
      if (table === "supplier_profiles") {
        return { insert: insertMock };
      }
      return {};
    });

    const client = {
      auth: { signUp: signUpMock },
      from: fromMock,
    };
    mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);

    const res = await registerSupplier(postJson("/api/auth/register/supplier", validSupplierPayload));
    expect(res.status).toBe(201);
    
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.id).toBe("sup-user-uuid-1");
    expect(body.supplier_profile.business_name).toBe("Tahu Sumedang Lembang");
    expect(body.supplier_profile.verification_status).toBe("pending");
    expect(body.consent).toBeDefined();
    expect(body.consent.location_consent).toBe(true);
    expect(body.consent.consented_at).toBeDefined();

    // Verify auth.signUp was called with role supplier and consent metadata
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: validSupplierPayload.email,
        password: validSupplierPayload.password,
        options: expect.objectContaining({
          data: expect.objectContaining({
            full_name: "Asep Sunandar",
            role: "supplier",
            location_consent: true,
          }),
        }),
      }),
    );

    // Verify supplier_profiles insert
    expect(fromMock).toHaveBeenCalledWith("supplier_profiles");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "sup-user-uuid-1",
        business_name: "Tahu Sumedang Lembang",
        address: "Jl. Raya Lembang No. 123, Bandung",
        latitude: -6.8188,
        longitude: 107.6186,
        nik: "3204123456780001",
        ktp_photo_url: "https://storage.wesup.id/wesup-assets/ktp/asep_ktp.webp",
        business_photo_url: "https://storage.wesup.id/wesup-assets/business/asep_store.webp",
        verification_status: "pending",
        is_location_locked: false,
      }),
    );
  });

  it("rejects when location_consent is false or missing", async () => {
    const payloadNoConsent = { ...validSupplierPayload, location_consent: false };
    const res = await registerSupplier(postJson("/api/auth/register/supplier", payloadNoConsent));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/consent|persetujuan/i);
  });

  it("rejects when coordinates are outside Bandung region (e.g. Jakarta)", async () => {
    const payloadJakarta = {
      ...validSupplierPayload,
      latitude: -6.1754,
      longitude: 106.8272,
    };
    const res = await registerSupplier(postJson("/api/auth/register/supplier", payloadJakarta));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Bandung/i);
  });

  it("rejects when coordinates are empty / null / non-numeric", async () => {
    const payloadNullCoords = {
      ...validSupplierPayload,
      latitude: null,
      longitude: null,
    };
    const res = await registerSupplier(postJson("/api/auth/register/supplier", payloadNullCoords));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/koordinat|coordinate|Bandung/i);
  });

  it("rejects when NIK is invalid (not 16 digits)", async () => {
    const payloadBadNik = {
      ...validSupplierPayload,
      nik: "12345",
    };
    const res = await registerSupplier(postJson("/api/auth/register/supplier", payloadBadNik));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/NIK/i);
  });

  it("rejects when essential fields are missing", async () => {
    const payloadMissing = {
      ...validSupplierPayload,
      business_name: "",
    };
    const res = await registerSupplier(postJson("/api/auth/register/supplier", payloadMissing));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/business_name|nama usaha/i);
  });

  it("handles duplicate email (user_already_exists) with 409", async () => {
    const signUpMock = vi.fn(async () => ({
      data: { user: null },
      error: { code: "user_already_exists", message: "User already registered" },
    }));
    const client = { auth: { signUp: signUpMock } };
    mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);

    const res = await registerSupplier(postJson("/api/auth/register/supplier", validSupplierPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already registered|already exists|terdaftar/i);
  });

  it("handles duplicate NIK with 409", async () => {
    const mockUser = { id: "sup-user-uuid-2", email: validSupplierPayload.email };
    const signUpMock = vi.fn(async () => ({
      data: { user: mockUser },
      error: null,
    }));

    const insertMock = vi.fn(async () => ({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint supplier_profiles_nik_key" },
    }));

    const client = {
      auth: { signUp: signUpMock },
      from: vi.fn(() => ({ insert: insertMock })),
    };
    mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);

    const res = await registerSupplier(postJson("/api/auth/register/supplier", validSupplierPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/NIK/i);
  });
});
