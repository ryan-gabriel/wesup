import { describe, expect, it, vi, beforeEach } from "vitest";

const URL = "https://woxgghuoeljagnkldqtf.supabase.co";
const KEY = "sb_publishable_test";

const cookieStore = vi.hoisted(() => ({
  store: {
    getAll: vi.fn<() => Array<{ name: string; value: string }>>(() => []),
    set: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore.store),
}));

async function loadGetServerClient() {
  vi.resetModules();
  const mod = await import("@/lib/supabase/server");
  return mod.getServerClient;
}

describe("supabase server client factory", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("throws when only the URL is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("throws when only the publishable key is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("creates a cookie-based client when both env vars are present", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const getServerClient = await loadGetServerClient();
    const client = await getServerClient();
    expect(client.auth).toBeDefined();
    expect(client.from).toBeDefined();
  });

  it("passes cookie reads through to the next/headers store", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    const incoming = [{ name: "sb-test", value: "abc" }];
    cookieStore.store.getAll.mockReturnValue(incoming);
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: vi.fn(
        (_url: string, _key: string, options: unknown) => options,
      ),
    }));
    const mod = await import("@/lib/supabase/server");
    const options = (await mod.getServerClient()) as unknown as {
      cookies: {
        getAll: () => typeof incoming;
        setAll: (cookiesToSet: CookieToSet[]) => void;
      };
    };
    expect(options.cookies.getAll()).toEqual(incoming);
    vi.doUnmock("@supabase/ssr");
  });

  it("applies refreshed session cookies through setAll", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: vi.fn(
        (_url: string, _key: string, options: unknown) => options,
      ),
    }));
    const mod = await import("@/lib/supabase/server");
    const options = (await mod.getServerClient()) as unknown as {
      cookies: { setAll: (cookiesToSet: CookieToSet[]) => void };
    };
    const cookiesToSet: CookieToSet[] = [
      { name: "sb-token", value: "new", options: { path: "/" } },
      { name: "sb-refresh", value: "new2" },
    ];
    options.cookies.setAll(cookiesToSet);
    expect(cookieStore.store.set).toHaveBeenCalledTimes(2);
    expect(cookieStore.store.set).toHaveBeenNthCalledWith(1, "sb-token", "new", {
      path: "/",
    });
    expect(cookieStore.store.set).toHaveBeenNthCalledWith(2, "sb-refresh", "new2", undefined);
    vi.doUnmock("@supabase/ssr");
  });

  it("swallows cookie write failures in setAll", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
    vi.resetModules();
    vi.doMock("@supabase/ssr", () => ({
      createServerClient: vi.fn(
        (_url: string, _key: string, options: unknown) => options,
      ),
    }));
    const mod = await import("@/lib/supabase/server");
    const options = (await mod.getServerClient()) as unknown as {
      cookies: { setAll: (cookiesToSet: CookieToSet[]) => void };
    };
    cookieStore.store.set.mockImplementation(() => {
      throw new Error("cookies are read-only outside request scope");
    });
    expect(() =>
      options.cookies.setAll([{ name: "sb-token", value: "new" }]),
    ).not.toThrow();
    vi.doUnmock("@supabase/ssr");
  });
  it("throws when env vars are completely unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    vi.resetModules();
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });
});

interface CookieToSet {
  name: string;
  value: string;
  options?: { path?: string };
}
