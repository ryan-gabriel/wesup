import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  resolveSupabaseAdminConfiguration,
  SupabaseAdminConfigurationError,
} from "@/lib/supabase/admin";

describe("Supabase admin configuration", () => {
  it("requires the project URL and an admin key", () => {
    expect(() => resolveSupabaseAdminConfiguration({})).toThrowError(
      SupabaseAdminConfigurationError,
    );
    expect(() =>
      resolveSupabaseAdminConfiguration({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }),
    ).toThrowError(SupabaseAdminConfigurationError);
    expect(() =>
      resolveSupabaseAdminConfiguration({ SUPABASE_SERVICE_ROLE_KEY: "service-key" }),
    ).toThrowError(SupabaseAdminConfigurationError);
  });

  it("trims values and prefers SUPABASE_SECRET_KEY", () => {
    expect(
      resolveSupabaseAdminConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "  https://example.supabase.co/  ",
        SUPABASE_SECRET_KEY: "  secret-key  ",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co/",
      adminKey: "secret-key",
    });
  });

  it("falls back to the legacy service-role variable", () => {
    expect(
      resolveSupabaseAdminConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      adminKey: "service-key",
    });
  });
});
