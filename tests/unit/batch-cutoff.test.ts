import { describe, expect, it, vi } from "vitest";
import {
  ensureBatchCutoff,
  resolveTier,
  type CutoffDeps,
  type CutoffTier,
} from "@/lib/batches/cutoff";

// Journeys:
// J1 — sistem mengunci harga tier dari count pendaftar saat cutoff (fallback Tier 1)
// J2 — cutoff idempoten + 1 request migrasi (lock), sisanya reader
// J3 — registrasi after-cutoff ditolak; registrasi valid jadi pending_payment terkunci

const TIERS: CutoffTier[] = [
  { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 10000 },
  { tier_number: 2, min_volume: 50, max_volume: 99, price_per_unit: 8000 },
  { tier_number: 3, min_volume: 100, max_volume: null, price_per_unit: 6000 },
];

const CLOSES_AT = "2030-01-02T00:00:00.000Z";
const AFTER_CLOSE = Date.parse("2030-01-02T00:00:01.000Z");
const BEFORE_CLOSE = Date.parse("2030-01-01T00:00:00.000Z");

function deps(overrides: Partial<CutoffDeps> = {}): CutoffDeps & {
  acquire: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
} {
  const acquire = vi.fn(async () => "tok");
  const release = vi.fn(async () => {});
  const commit = vi.fn(async () => 2);
  return {
    loadBatch: async () => ({ status: "published", closesAt: CLOSES_AT, tiers: TIERS }),
    getVolume: async () => 60,
    countRegistrations: async () => 60,
    listPendingRegistrations: async () => [
      { id: "r1", quantity: 2 },
      { id: "r2", quantity: 1 },
    ],
    acquireLock: acquire,
    releaseLock: release,
    commitLock: commit,
    acquire,
    release,
    commit,
    ...overrides,
  } as CutoffDeps & {
    acquire: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };
}

describe("resolveTier (J1 — resolusi harga tier)", () => {
  it("locks Tier 1 when volume is below every tier minimum", () => {
    expect(resolveTier(TIERS, 0)?.tier_number).toBe(1);
    expect(resolveTier(TIERS, 49)?.tier_number).toBe(1);
  });

  it("picks the highest qualifying tier by count", () => {
    expect(resolveTier(TIERS, 50)?.tier_number).toBe(2);
    expect(resolveTier(TIERS, 99)?.tier_number).toBe(2);
    expect(resolveTier(TIERS, 100)?.tier_number).toBe(3);
    expect(resolveTier(TIERS, 10000)?.tier_number).toBe(3);
  });

  it("falls back to the lower tier inside a volume gap (no unearned discount)", () => {
    const gapped: CutoffTier[] = [
      { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 10000 },
      { tier_number: 2, min_volume: 100, max_volume: null, price_per_unit: 6000 },
    ];
    expect(resolveTier(gapped, 75)?.tier_number).toBe(1);
  });

  it("is order-independent", () => {
    expect(resolveTier([...TIERS].reverse(), 60)?.tier_number).toBe(2);
  });

  it("returns null when the batch has no tiers", () => {
    expect(resolveTier([], 60)).toBeNull();
  });
});

describe("ensureBatchCutoff (J2 — lazy evaluation absolut)", () => {
  it("skips before closes_at without touching the lock (anti time-travel)", async () => {
    const d = deps();
    const res = await ensureBatchCutoff(d, "batch-1", BEFORE_CLOSE);
    expect(res).toEqual({ applied: false, reason: "not_due" });
    expect(d.acquire).not.toHaveBeenCalled();
    expect(d.commit).not.toHaveBeenCalled();
  });

  it("skips when the batch is already locked (idempotent)", async () => {
    const d = deps({
      loadBatch: async () => ({ status: "closed", closesAt: CLOSES_AT, tiers: TIERS }),
    });
    const res = await ensureBatchCutoff(d, "batch-1", AFTER_CLOSE);
    expect(res).toEqual({ applied: false, reason: "already_locked" });
    expect(d.acquire).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown batch", async () => {
    const d = deps({ loadBatch: async () => null });
    expect(await ensureBatchCutoff(d, "missing", AFTER_CLOSE)).toEqual({
      applied: false,
      reason: "not_found",
    });
  });

  it("returns no_tiers when the batch has no pricing tiers", async () => {
    const d = deps({
      loadBatch: async () => ({ status: "published", closesAt: CLOSES_AT, tiers: [] }),
    });
    expect(await ensureBatchCutoff(d, "batch-1", AFTER_CLOSE)).toEqual({
      applied: false,
      reason: "no_tiers",
    });
  });

  it("locks Tier 2 and commits pending registrations when due", async () => {
    const d = deps();
    const res = await ensureBatchCutoff(d, "batch-1", AFTER_CLOSE);
    expect(res.applied).toBe(true);
    if (!res.applied) throw new Error("expected applied");
    expect(res.totalVolume).toBe(60);
    expect(res.tier.tier_number).toBe(2);
    expect(res.affected).toBe(2);
    expect(d.commit).toHaveBeenCalledWith(
      "batch-1",
      expect.objectContaining({ tier_number: 2 }),
      [
        { id: "r1", quantity: 2 },
        { id: "r2", quantity: 1 },
      ],
    );
    expect(d.release).toHaveBeenCalledWith("tok");
  });

  it("falls back to Tier 1 when volume never reached Tier 2 (J1)", async () => {
    const d = deps({ getVolume: async () => 7 });
    const res = await ensureBatchCutoff(d, "batch-1", AFTER_CLOSE);
    expect(res.applied).toBe(true);
    if (!res.applied) throw new Error("expected applied");
    expect(res.tier.tier_number).toBe(1);
    expect(res.tier.price_per_unit).toBe(10000);
  });

  it("falls back to the DB count when Redis has no counter (reconciliation)", async () => {
    const d = deps({ getVolume: async () => null, countRegistrations: async () => 120 });
    const res = await ensureBatchCutoff(d, "batch-1", AFTER_CLOSE);
    expect(res.applied).toBe(true);
    if (!res.applied) throw new Error("expected applied");
    expect(res.totalVolume).toBe(120);
    expect(res.tier.tier_number).toBe(3);
  });

  it("acts as reader when another request holds the lock (no double migration)", async () => {
    const d = deps({ acquireLock: async () => null });
    const res = await ensureBatchCutoff(d, "batch-1", AFTER_CLOSE);
    expect(res).toEqual({ applied: false, reason: "lock_busy" });
    expect(d.commit).not.toHaveBeenCalled();
  });

  it("releases the lock even when commit throws", async () => {
    const d = deps({ commitLock: async () => { throw new Error("db down"); } });
    await expect(ensureBatchCutoff(d, "batch-1", AFTER_CLOSE)).rejects.toThrow("db down");
    expect(d.release).toHaveBeenCalledWith("tok");
  });
});
