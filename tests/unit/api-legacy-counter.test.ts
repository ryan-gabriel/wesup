import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as legacyRegister } from "@/app/api/batches/[id]/register/route";
import { POST as cancelRegistration } from "@/app/api/registrations/[id]/cancel/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const { incrbyMock } = vi.hoisted(() => ({
  incrbyMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  // ponytail: hanya incrby — kode lama yang masih memanggil incr/decr
  // langsung akan meledak di sini dan menggagalkan test dengan jelas
  redis: { incrby: incrbyMock },
}));

vi.mock("@/app/api/_lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 4 })),
}));

vi.mock("@/app/api/_lib/distributed-lock", () => ({
  acquireLock: vi.fn(async () => "tok"),
  releaseLock: vi.fn(async () => true),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const REG_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "66666666-6666-4666-8666-666666666666";

const VOLUME_KEY = `batch:${BATCH_ID}:count`;

function mockUmkmAuth() {
  const getUser = vi.fn(async () => ({
    data: { user: { id: USER_ID } },
    error: null,
  }));
  const profileSingle = vi.fn(async () => ({
    data: { role: "umkm", status: "active", full_name: "U" },
    error: null,
  }));
  return { getUser, profileSingle };
}

function postJson(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("legacy register counter alignment (sum quantity, skema main)", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    incrbyMock.mockReset();
    incrbyMock.mockResolvedValue(17);
  });

  it("reserves quantity via incrby on batch:{id}:count, tanpa upsert manual", async () => {
    const { getUser, profileSingle } = mockUmkmAuth();
    const insertSingle = vi.fn(async () => ({
      data: { id: REG_ID, created_at: "2030-01-01T00:00:00.000Z" },
      error: null,
    }));
    const from = vi.fn((table: string) => {
      if (table === "batches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: BATCH_ID,
                  supplier_id: "s1",
                  min_quantity: 1,
                  status: "published",
                  batch_timeline: {
                    registration_opens_at: "2030-01-01T00:00:00.000Z",
                    registration_closes_at: "2030-02-01T00:00:00.000Z",
                  },
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
          })),
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: insertSingle })) })),
        };
      }
      if (table === "umkm_profiles") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
        };
      }
      return {};
    });
    mockGetServerClient.mockResolvedValue({
      auth: { getUser },
      from,
    } as unknown as SupabaseClient<Database>);

    const res = await legacyRegister(
      postJson(`/api/batches/${BATCH_ID}/register`, { quantity: 5 }),
      params(BATCH_ID),
    );
    expect(res.status).toBe(201);
    expect(incrbyMock).toHaveBeenCalledWith(VOLUME_KEY, 5);
    expect(
      from.mock.calls.some(([table]) => table === "registration_counters"),
    ).toBe(false);
    await expect(res.json()).resolves.toMatchObject({
      data: { registration_count: 17 },
    });
    expect(profileSingle).toBeDefined();
  });

  it("rolls back quantity via incrby negatif saat insert gagal", async () => {
    const { getUser } = mockUmkmAuth();
    const from = vi.fn((table: string) => {
      if (table === "batches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: BATCH_ID,
                  supplier_id: "s1",
                  min_quantity: 1,
                  status: "published",
                  batch_timeline: {
                    registration_opens_at: "2030-01-01T00:00:00.000Z",
                    registration_closes_at: "2030-02-01T00:00:00.000Z",
                  },
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "registrations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
            })),
          })),
        };
      }
      if (table === "umkm_profiles") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: null })) })) })),
        };
      }
      return {};
    });
    mockGetServerClient.mockResolvedValue({
      auth: { getUser },
      from,
    } as unknown as SupabaseClient<Database>);

    const res = await legacyRegister(
      postJson(`/api/batches/${BATCH_ID}/register`, { quantity: 5 }),
      params(BATCH_ID),
    );
    expect(res.status).toBe(500);
    expect(incrbyMock).toHaveBeenNthCalledWith(1, VOLUME_KEY, 5);
    expect(incrbyMock).toHaveBeenNthCalledWith(2, VOLUME_KEY, -5);
  });
});

describe("legacy cancel counter alignment (sum quantity, skema main)", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    incrbyMock.mockReset();
    incrbyMock.mockResolvedValue(12);
  });

  it("releases the exact quantity via incrby negatif, tanpa upsert manual", async () => {
    const { getUser } = mockUmkmAuth();
    const from = vi.fn((table: string) => {
      if (table === "registrations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: REG_ID,
                    batch_id: BATCH_ID,
                    umkm_id: USER_ID,
                    status: "registered",
                    quantity: 5,
                  },
                  error: null,
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }
      return {};
    });
    mockGetServerClient.mockResolvedValue({
      auth: { getUser },
      from,
    } as unknown as SupabaseClient<Database>);

    const res = await cancelRegistration(
      postJson(`/api/registrations/${REG_ID}/cancel`, {}),
      params(REG_ID),
    );
    expect(res.status).toBe(200);
    expect(incrbyMock).toHaveBeenCalledWith(VOLUME_KEY, -5);
    expect(
      from.mock.calls.some(([table]) => table === "registration_counters"),
    ).toBe(false);
  });
});
