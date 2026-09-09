/**
 * Lazy Evaluation — penguncian volume & harga tier saat cutoff (PRD 3.2, Fase 4).
 *
 * Tanpa cron: transisi `published → closed` + `registered → pending_payment`
 * dieksekusi on-demand oleh request pertama yang tiba setelah
 * `registration_closes_at`. Waktu selalu dari server (argumen `nowMs`),
 * tidak pernah dari payload client (anti manipulasi batas waktu).
 */

export interface CutoffTier {
  tier_number: number;
  min_volume: number;
  max_volume: number | null;
  price_per_unit: number | string;
}

export interface CutoffBatch {
  status: string;
  closesAt: string;
  tiers: CutoffTier[];
}

export interface CutoffRegistration {
  id: string;
  quantity: number;
}

export interface CutoffDeps {
  loadBatch(batchId: string): Promise<CutoffBatch | null>;
  getVolume(batchId: string): Promise<number | null>;
  countRegistrations(batchId: string): Promise<number>;
  listPendingRegistrations(batchId: string): Promise<CutoffRegistration[]>;
  acquireLock(): Promise<string | null>;
  releaseLock(token: string): Promise<unknown>;
  commitLock(
    batchId: string,
    tier: CutoffTier,
    regs: CutoffRegistration[],
  ): Promise<number>;
}

export type CutoffResult =
  | {
      applied: false;
      reason: "not_found" | "not_due" | "already_locked" | "no_tiers" | "lock_busy";
    }
  | { applied: true; totalVolume: number; tier: CutoffTier; affected: number };

/**
 * Resolusi harga tier dari total volume (count pendaftar).
 * Tier tertinggi yang `min_volume`-nya tercapai menang; volume di bawah
 * semua minimum (atau di celah antar tier) terkunci ke Tier 1 (harga dasar).
 */
export function resolveTier(
  tiers: CutoffTier[],
  totalVolume: number,
): CutoffTier | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.tier_number - b.tier_number);
  let won = sorted[0]; // ponytail: Tier 1 fallback — jangan beri diskon yang tak tercapai
  for (const tier of sorted) {
    if (totalVolume >= tier.min_volume) won = tier;
  }
  return won;
}

/**
 * Evaluasi cutoff satu batch. Idempoten: pemicu kedua dan seterusnya
 * hanya membaca (`already_locked` / `lock_busy`), tidak migrasi ulang.
 */
export async function ensureBatchCutoff(
  deps: CutoffDeps,
  batchId: string,
  nowMs: number,
): Promise<CutoffResult> {
  const batch = await deps.loadBatch(batchId);
  if (!batch) return { applied: false, reason: "not_found" };
  if (batch.status !== "published") return { applied: false, reason: "already_locked" };

  const closesMs = Date.parse(batch.closesAt);
  if (Number.isNaN(closesMs) || nowMs < closesMs) {
    return { applied: false, reason: "not_due" };
  }
  if (batch.tiers.length === 0) return { applied: false, reason: "no_tiers" };

  // Redis INCR = runtime source of truth; DB count = rekonsiliasi saat Redis kosong
  const cached = await deps.getVolume(batchId);
  const totalVolume = cached ?? (await deps.countRegistrations(batchId));
  const tier = resolveTier(batch.tiers, totalVolume);
  if (!tier) return { applied: false, reason: "no_tiers" };

  // Distributed lock: 1 request migrasi, sisanya reader (PRD 3.1)
  const token = await deps.acquireLock();
  if (!token) return { applied: false, reason: "lock_busy" };
  try {
    const regs = await deps.listPendingRegistrations(batchId);
    const affected = await deps.commitLock(batchId, tier, regs);
    return { applied: true, totalVolume, tier, affected };
  } finally {
    await deps.releaseLock(token);
  }
}
