import { describe, expect, it, vi } from "vitest";
import {
  isSupplierConfigurationError,
  registerSupplier,
  SupplierRegistrationError,
  type RegistrationDependencies,
} from "@/lib/supplier-registration/service";
vi.mock("server-only", () => ({}));

import type { SupplierRegistrationFields } from "@/lib/supplier-registration/contracts";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function validFields(): SupplierRegistrationFields {
  return {
    fullName: "Budi Supplier",
    email: "BUDI@EXAMPLE.COM ",
    phone: "081234567890",
    password: "password-123",
    businessName: "Toko Budi",
    address: "Jl. Bandung No. 1",
    latitude: -6.914744,
    longitude: 107.60981,
    businessPhoto: new File([new Uint8Array([1, 2, 3])], "business.webp", {
      type: "image/webp",
    }),
  };
}

function mockDependencies(options: {
  lookup?: { data: { id: string } | null; error: { message?: string } | null };
  signup?: {
    data: { user: { id: string; identities?: unknown[] } | null; session: unknown };
    error: { code?: string; message?: string } | null;
  };
  upload?: { data: { path: string } | null; error: { message?: string } | null };
  insert?: { error: { message?: string } | null };
}) {
  const maybeSingle = vi.fn(async () =>
    options.lookup ?? { data: null, error: null },
  );
  const signUp = vi.fn(async () =>
    options.signup ?? {
      data: { user: { id: USER_ID, identities: [{}] }, session: null },
      error: null,
    },
  );
  const upload = vi.fn(async () =>
    options.upload ?? { data: { path: `business/${USER_ID}/photo.webp` }, error: null },
  );
  const remove = vi.fn(async () => ({ error: null }));
  const deleteUser = vi.fn(async () => ({ error: null }));
  const insert = vi.fn(async () => options.insert ?? { error: null });
  const profileQuery = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle })),
    })),
  };
  const storageBucket = { upload, remove };
  const adminClient = {
    storage: { from: vi.fn(() => storageBucket) },
    auth: { admin: { deleteUser } },
    from: vi.fn((table: string) =>
      table === "profiles" ? profileQuery : { insert },
    ),
  };
  const dependencies = {
    authClient: { auth: { signUp } },
    adminClient,
  } as unknown as RegistrationDependencies;
  return { dependencies, maybeSingle, signUp, upload, remove, deleteUser, insert };
}

describe("registerSupplier", () => {
  it("creates a pending supplier profile after auth and photo upload", async () => {
    const mocks = mockDependencies({});
    const result = await registerSupplier(validFields(), mocks.dependencies);

    expect(result).toEqual({
      ok: true,
      verificationStatus: "pending",
      requiresEmailConfirmation: true,
    });
    expect(mocks.maybeSingle).toHaveBeenCalledWith();
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "budi@example.com",
      password: "password-123",
      options: { data: { full_name: "Budi Supplier", phone: "081234567890" } },
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^business/${USER_ID}/.+\\.webp$`)),
      expect.any(File),
      { contentType: "image/webp", cacheControl: "3600", upsert: false },
    );
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      business_name: "Toko Budi",
      address: "Jl. Bandung No. 1",
      latitude: -6.914744,
      longitude: 107.60981,
      business_photo_url: `business/${USER_ID}/photo.webp`,
      ktp_photo_url: null,
      nik: null,
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("marks profile lookup failures with the email_lookup stage", async () => {
    const mocks = mockDependencies({
      lookup: { data: null, error: { message: "database unavailable" } },
    });

    await expect(registerSupplier(validFields(), mocks.dependencies)).rejects.toMatchObject({
      name: "SupplierRegistrationError",
      stage: "email_lookup",
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("rolls back the auth user when the business photo upload fails", async () => {
    const mocks = mockDependencies({
      upload: { data: null, error: { message: "bucket unavailable" } },
    });

    await expect(registerSupplier(validFields(), mocks.dependencies)).rejects.toMatchObject({
      name: "SupplierRegistrationError",
      stage: "photo_upload",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("removes the uploaded photo and auth user when profile insert fails", async () => {
    const mocks = mockDependencies({
      insert: { error: { message: "insert failed" } },
    });

    await expect(registerSupplier(validFields(), mocks.dependencies)).rejects.toMatchObject({
      name: "SupplierRegistrationError",
      stage: "profile_insert",
    });
    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp(`^business/${USER_ID}/.+\\.webp$`)),
    ]);
    expect(mocks.deleteUser).toHaveBeenCalledWith(USER_ID);
  });
});

describe("supplier registration error classification", () => {
  it("identifies a missing admin configuration without exposing secret details", () => {
    const error = new SupplierRegistrationError(
      "Supplier admin configuration is missing",
      "configuration",
    );
    expect(isSupplierConfigurationError(error)).toBe(true);
    expect(error.message).not.toContain("service_role");
  });
});
