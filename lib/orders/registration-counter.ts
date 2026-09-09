import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

export const VOLUME_KEY_PREFIX = "batch:";
export const VOLUME_KEY_SUFFIX = ":count";
export const CUTOFF_LOCK_PREFIX = "cutoff-lock:";
export const CUTOFF_LOCK_TTL_SECONDS = 30;

const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

export function volumeKey(batchId: string): string {
  return `${VOLUME_KEY_PREFIX}${batchId}${VOLUME_KEY_SUFFIX}`;
}

export function cutoffLockKey(batchId: string): string {
  return `${CUTOFF_LOCK_PREFIX}${batchId}`;
}

export async function adjustVolumeCounter(
  batchId: string,
  quantityDelta: number,
): Promise<number> {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
    throw new Error("quantityDelta must be a non-zero safe integer");
  }
  return redis.incrby(volumeKey(batchId), quantityDelta);
}

/** @deprecated Prefer adjustVolumeCounter so registrations reserve quantity. */
export async function incrementVolumeCounter(
  batchId: string,
  quantity = 1,
): Promise<number> {
  return adjustVolumeCounter(batchId, quantity);
}

/** @deprecated Prefer adjustVolumeCounter with a negative delta. */
export async function decrementVolumeCounter(
  batchId: string,
  quantity = 1,
): Promise<number> {
  return adjustVolumeCounter(batchId, -quantity);
}

export async function getVolumeCounter(batchId: string): Promise<number | null> {
  const value = await redis.get<number>(volumeKey(batchId));
  return typeof value === "number" ? value : null;
}

export async function restoreVolumeCounter(
  batchId: string,
  quantity: number,
): Promise<void> {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new Error("quantity must be a non-negative safe integer");
  }
  await redis.set(volumeKey(batchId), quantity);
}

export async function resetVolumeCounter(batchId: string): Promise<void> {
  await redis.del(volumeKey(batchId));
}

export interface CutoffLock {
  acquired: boolean;
  token: string;
}

export async function acquireCutoffLock(
  batchId: string,
): Promise<CutoffLock> {
  const token = randomUUID();
  const result = await redis.set(cutoffLockKey(batchId), token, {
    nx: true,
    ex: CUTOFF_LOCK_TTL_SECONDS,
  });
  if (result !== "OK") {
    return { acquired: false, token: "" };
  }
  return { acquired: true, token };
}

export async function releaseCutoffLock(
  batchId: string,
  token: string,
): Promise<void> {
  await redis.eval(RELEASE_LOCK_SCRIPT, [cutoffLockKey(batchId)], [token]);
}

export { RELEASE_LOCK_SCRIPT };
