import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AuthError, getCurrentUser, requireRole, requireActive, toAuthResponse } from "@/lib/supabase/auth";
import type { AuthClient } from "@/lib/supabase/auth";
import type { AccountStatus, Database, UserRole } from "@/types/database";

type IsAssignable<S, T> = S extends T ? true : false;

const realClient = createClient<Database>("https://example.supabase.co", "test-key");

function realProfileQuery(client: typeof realClient) {
  return client.from("profiles").select("role,status,full_name").eq("id", "user-1").single();
}

const realAuthGetUserFits: IsAssignable<
  ReturnType<typeof realClient.auth.getUser>,
  ReturnType<AuthClient["auth"]["getUser"]>
> = true;
const realSingleFits: IsAssignable<
  ReturnType<typeof realProfileQuery>,
  ReturnType<ReturnType<ReturnType<ReturnType<AuthClient["from"]>["select"]>["eq"]>["single"]>
> = true;

describe("real supabase client compatibility", () => {
  it("creates a real client without network access", () => {
    expect(realClient).toBeDefined();
    expect(realProfileQuery).toBeDefined();
  });

  it("satisfies the AuthClient getUser contract", () => {
    expect(realAuthGetUserFits).toBe(true);
  });

  it("satisfies the AuthClient profile query contract", () => {
    expect(realSingleFits).toBe(true);
  });
});

const ACTIVE_CONTEXT = {
  userId: "user-1",
  email: "test-supplier@example.com",
  role: "supplier" as UserRole,
  status: "active" as AccountStatus,
  fullName: "Test Supplier",
};

interface FakeClientOptions {
  user?: { id: string; email?: string } | null;
  getUserError?: Error | null;
  profile?: { role: UserRole; status: AccountStatus; full_name: string } | null;
  profileError?: Error | null;
}

function fakeClient(options: FakeClientOptions) {
  const getUser = vi.fn(async () =>
    options.getUserError
      ? { data: { user: null }, error: options.getUserError }
      : { data: { user: options.user ?? null }, error: null },
  );
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () =>
          options.profileError
            ? { data: null, error: options.profileError }
            : { data: options.profile ?? null, error: null },
        ),
      })),
    })),
  }));
  return { client: { auth: { getUser }, from }, getUser, from };
}

describe("getCurrentUser", () => {
  it("returns null when there is no session", async () => {
    const { client } = fakeClient({ user: null });
    await expect(getCurrentUser(client)).resolves.toBeNull();
  });

  it("returns null when getUser fails", async () => {
    const { client } = fakeClient({ getUserError: new Error("boom") });
    await expect(getCurrentUser(client)).resolves.toBeNull();
  });

  it("returns null when the profile lookup fails", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profileError: new Error("boom"),
    });
    await expect(getCurrentUser(client)).resolves.toBeNull();
  });

  it("returns the auth context for an active session", async () => {
    const { client } = fakeClient({
      user: { id: "user-1", email: "test-supplier@example.com" },
      profile: { role: "supplier", status: "active", full_name: "Test Supplier" },
    });
    await expect(getCurrentUser(client)).resolves.toEqual(ACTIVE_CONTEXT);
  });

  it("carries the user email into the context", async () => {
    const { client } = fakeClient({
      user: { id: "user-1", email: "buyer@example.com" },
      profile: { role: "umkm", status: "active", full_name: "Budi Buyer" },
    });
    await expect(getCurrentUser(client)).resolves.toMatchObject({
      email: "buyer@example.com",
    });
  });

  it("defaults the email to an empty string when the user has none", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profile: { role: "umkm", status: "active", full_name: "Budi Buyer" },
    });
    await expect(getCurrentUser(client)).resolves.toMatchObject({ email: "" });
  });
});

describe("requireRole", () => {
  it("throws a 401 when there is no session", async () => {
    const { client } = fakeClient({ user: null });
    await expect(requireRole(client, ["admin"])).rejects.toMatchObject({
      status: 401,
      message: "Sign in required",
    });
  });

  it("throws a 403 when the role is not allowed", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profile: { role: "umkm", status: "active", full_name: "UMKM Owner" },
    });
    await expect(requireRole(client, ["admin"])).rejects.toMatchObject({
      status: 403,
      message: "Insufficient permissions",
    });
  });

  it("throws a 403 when the account is suspended even with an allowed role", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profile: { role: "admin", status: "suspended_temporary", full_name: "Admin" },
    });
    await expect(requireRole(client, ["admin"])).rejects.toMatchObject({
      status: 403,
      message: "Insufficient permissions",
    });
  });

  it("throws a 403 when the account is banned", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profile: { role: "supplier", status: "banned", full_name: "Banned" },
    });
    await expect(requireRole(client, ["supplier"])).rejects.toMatchObject({
      status: 403,
      message: "Insufficient permissions",
    });
  });

  it("resolves the context when the role is allowed and the account is active", async () => {
    const { client } = fakeClient({
      user: { id: "user-1", email: "test-supplier@example.com" },
      profile: { role: "supplier", status: "active", full_name: "Test Supplier" },
    });
    await expect(requireRole(client, ["supplier"])).resolves.toEqual(ACTIVE_CONTEXT);
  });
});

describe("requireActive", () => {
  it("throws a 401 when there is no session", async () => {
    const { client } = fakeClient({ user: null });
    await expect(requireActive(client)).rejects.toMatchObject({
      status: 401,
      message: "Sign in required",
    });
  });

  it("throws a 403 when the account is suspended and includes the status in the message", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profile: { role: "supplier", status: "suspended_temporary", full_name: "Suspended" },
    });
    const error = await requireActive(client).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.status).toBe(403);
    expect(error.message).toContain("suspended_temporary");
  });

  it("throws a 403 when the account is banned and includes the status in the message", async () => {
    const { client } = fakeClient({
      user: { id: "user-1" },
      profile: { role: "supplier", status: "banned", full_name: "Banned" },
    });
    const error = await requireActive(client).catch((e) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error.status).toBe(403);
    expect(error.message).toContain("banned");
  });

  it("resolves the context when the account is active", async () => {
    const { client } = fakeClient({
      user: { id: "user-1", email: "test-supplier@example.com" },
      profile: { role: "supplier", status: "active", full_name: "Test Supplier" },
    });
    await expect(requireActive(client)).resolves.toEqual(ACTIVE_CONTEXT);
  });
});

describe("toAuthResponse", () => {
  it("maps a 401 AuthError to a JSON response", () => {
    const response = toAuthResponse(new AuthError(401, "Sign in required"));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    return response.json().then((body) => expect(body).toEqual({ error: "Sign in required" }));
  });

  it("maps a 403 AuthError to a JSON response", () => {
    const response = toAuthResponse(new AuthError(403, "Account is not active"));
    expect(response.status).toBe(403);
    return response.json().then((body) => expect(body).toEqual({ error: "Account is not active" }));
  });

  it("maps an unknown error to a generic 500 response", () => {
    const response = toAuthResponse(new Error("boom"));
    expect(response.status).toBe(500);
    return response.json().then((body) => expect(body).toEqual({ error: "Internal server error" }));
  });
});
