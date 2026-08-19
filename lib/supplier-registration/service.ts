import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";
import { normalizeEmail, type RegistrationSuccessResponse, type SupplierRegistrationFields } from "@/lib/supplier-registration/contracts";

export class DuplicateSupplierEmailError extends Error {
  constructor() {
    super("Supplier email already exists");
    this.name = "DuplicateSupplierEmailError";
  }
}

export class SupplierEmailRateLimitError extends Error {
  constructor() {
    super("Supabase confirmation email rate limit exceeded");
    this.name = "SupplierEmailRateLimitError";
  }
}

export class SupplierRegistrationError extends Error {
  constructor(message = "Supplier registration failed") {
    super(message);
    this.name = "SupplierRegistrationError";
  }
}

export interface RegistrationDependencies {
  authClient: {
    auth: {
      signUp(input: {
        email: string;
        password: string;
        options: { data: { full_name: string; phone: string } };
      }): Promise<{
        data: { user: { id: string; identities?: unknown[] } | null; session: unknown };
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
  adminClient: {
    storage: {
      from(bucket: "wesup-assets"): {
        upload(path: string, file: File, options: { contentType: string; cacheControl: string; upsert: boolean }): Promise<{
          data: { path: string } | null;
          error: { message?: string } | null;
        }>;
        remove(paths: string[]): Promise<{ error: { message?: string } | null }>;
      };
    };
    auth: {
      admin: {
        deleteUser(userId: string): Promise<{ error: { message?: string } | null }>;
      };
    };
    from(table: "profiles"): {
      select(columns: "id"): {
        eq(column: "email", value: string): {
          maybeSingle(): Promise<{
            data: { id: string } | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
    from(table: "supplier_profiles"): {
      insert(row: {
        user_id: string;
        business_name: string;
        address: string;
        latitude: number;
        longitude: number;
        business_photo_url: string;
        ktp_photo_url: null;
        nik: null;
      }): Promise<{ error: { message?: string } | null }>;
    };
  };
}

export async function registerSupplier(
  fields: SupplierRegistrationFields,
  dependencies?: RegistrationDependencies,
): Promise<RegistrationSuccessResponse> {
  const authClient: RegistrationDependencies["authClient"] = dependencies?.authClient ?? (await getServerClient() as unknown as RegistrationDependencies["authClient"]);
  const adminClient: RegistrationDependencies["adminClient"] = dependencies?.adminClient ?? (getAdminClient() as unknown as RegistrationDependencies["adminClient"]);
  const email = normalizeEmail(fields.email);

  const { data: existing, error: lookupError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) throw new SupplierRegistrationError();
  if (existing) throw new DuplicateSupplierEmailError();

  const { data: signup, error: signupError } = await authClient.auth.signUp({
    email,
    password: fields.password,
    options: { data: { full_name: fields.fullName, phone: fields.phone } },
  });
  if (signupError) {
    if (signupError.code === "over_email_send_rate_limit") {
      throw new SupplierEmailRateLimitError();
    }
    if (signupError.code === "user_already_exists" || /already registered|already exists/i.test(signupError.message ?? "")) {
      throw new DuplicateSupplierEmailError();
    }
    throw new SupplierRegistrationError();
  }

  const user = signup.user;
  if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) {
    throw new DuplicateSupplierEmailError();
  }

  const path = `business/${user.id}/${randomUUID()}.webp`;
  let uploaded = false;
  try {
    const upload = await adminClient.storage.from("wesup-assets").upload(
      path,
      fields.businessPhoto,
      { contentType: "image/webp", cacheControl: "3600", upsert: false },
    );
    if (upload.error || !upload.data) throw new SupplierRegistrationError();
    uploaded = true;

    const { error: insertError } = await adminClient.from("supplier_profiles").insert({
      user_id: user.id,
      business_name: fields.businessName,
      address: fields.address,
      latitude: fields.latitude,
      longitude: fields.longitude,
      business_photo_url: upload.data.path,
      ktp_photo_url: null,
      nik: null,
    });
    if (insertError) throw new SupplierRegistrationError();

    return {
      ok: true,
      verificationStatus: "pending",
      requiresEmailConfirmation: signup.session === null,
    };
  } catch (error) {
    if (uploaded) {
      await adminClient.storage.from("wesup-assets").remove([path]).catch(() => undefined);
    }
    await adminClient.auth.admin.deleteUser(user.id).catch(() => undefined);
    if (error instanceof SupplierRegistrationError) throw error;
    throw new SupplierRegistrationError();
  }
}

export function isDuplicateSupplierEmailError(error: unknown): boolean {
  return error instanceof DuplicateSupplierEmailError;
}

export function isSupplierEmailRateLimitError(error: unknown): boolean {
  return error instanceof SupplierEmailRateLimitError;
}
