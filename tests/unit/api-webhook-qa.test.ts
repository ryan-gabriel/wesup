import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  GET as qaState,
  POST as qaToggle,
} from "@/app/api/webhook/midtrans/qa/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

const mockGetServerClient = vi.mocked(getServerClient);

const USER_ID = "66666666-6666-4666-8666-666666666666";

function mockActiveUser() {
  const getUser = vi.fn(async () => ({
    data: { user: { id: USER_ID } },
    error: null,
  }));
  const single = vi.fn(async () => ({
    data: { role: "umkm", status: "active", full_name: "QA" },
    error: null,
  }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single }) }) }));
  mockGetServerClient.mockResolvedValue({ auth: { getUser }, from } as unknown as SupabaseClient<Database>);
}

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/webhook/midtrans/qa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("QA webhook kill-switch (J3 — staging/dev only)", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENV", "development");
    mockGetServerClient.mockReset();
    for (const fn of Object.values(redisMock)) fn.mockReset();
  });

  it("refuses everything in production", async () => {
    vi.stubEnv("APP_ENV", "production");
    mockActiveUser();
    expect((await qaToggle(post({ mode: "disabled" }))).status).toBe(403);
    expect((await qaState()).status).toBe(403);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("disables the sync (indefinite) and reports state", async () => {
    mockActiveUser();
    redisMock.ttl.mockResolvedValue(-1);
    const res = await qaToggle(post({ mode: "disabled" }));
    expect(res.status).toBe(200);
    expect(redisMock.set).toHaveBeenCalledWith("webhook:midtrans:disabled", "1");
    redisMock.get.mockResolvedValue("1");
    const state = await qaState();
    await expect(state.json()).resolves.toMatchObject({
      success: true,
      data: { disabled: true },
    });
  });

  it("disables with a TTL to simulate delay, then re-enables", async () => {
    mockActiveUser();
    const res = await qaToggle(post({ mode: "disabled", ttl_seconds: 300 }));
    expect(res.status).toBe(200);
    expect(redisMock.set).toHaveBeenCalledWith(
      "webhook:midtrans:disabled",
      "1",
      { ex: 300 },
    );
    const back = await qaToggle(post({ mode: "enabled" }));
    expect(back.status).toBe(200);
    expect(redisMock.del).toHaveBeenCalledWith("webhook:midtrans:disabled");
  });

  it("rejects invalid mode and bad ttl", async () => {
    mockActiveUser();
    expect((await qaToggle(post({ mode: "pause" }))).status).toBe(400);
    expect((await qaToggle(post({ mode: "disabled", ttl_seconds: -5 }))).status).toBe(400);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("requires sign-in", async () => {
    mockGetServerClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    } as unknown as SupabaseClient<Database>);
    expect((await qaToggle(post({ mode: "disabled" }))).status).toBe(401);
  });
});
