import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | undefined;

export interface SupabaseAdminEnvironment {
  [key: string]: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface SupabaseAdminConfiguration {
  url: string;
  adminKey: string;
}

export class SupabaseAdminConfigurationError extends Error {
  constructor(message = "Missing Supabase secret-key configuration for supplier registration.") {
    super(message);
    this.name = "SupabaseAdminConfigurationError";
  }
}

export function resolveSupabaseAdminConfiguration(
  env: SupabaseAdminEnvironment = process.env,
): SupabaseAdminConfiguration {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const adminKey = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !adminKey) {
    throw new SupabaseAdminConfigurationError();
  }
  return { url, adminKey };
}

export function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;

  const { url, adminKey } = resolveSupabaseAdminConfiguration();
  adminClient = createClient<Database>(url, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}
