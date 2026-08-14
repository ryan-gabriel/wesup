import { redis } from "@/lib/redis";

/**
 * Acquire a distributed lock using Redis SET NX EX.
 *
 * @param resourceId - Logical resource to lock (e.g. "batch_register:uuid")
 * @param ttlSeconds - Auto-expire after this many seconds (prevents deadlock)
 * @returns Lock token string if acquired, null if already held
 */
export async function acquireLock(
  resourceId: string,
  ttlSeconds: number = 30,
): Promise<string | null> {
  const lockKey = `lock:${resourceId}`;
  const lockToken = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const result = await redis.set(lockKey, lockToken, {
    nx: true,
    ex: ttlSeconds,
  });

  return result === "OK" ? lockToken : null;
}

/**
 * Release a lock only if we still own it (compare-and-delete via Lua script).
 *
 * @param resourceId - Same resource id used in acquireLock
 * @param lockToken  - Token returned by acquireLock
 * @returns true if released, false if lock was already gone or owned by another
 */
export async function releaseLock(
  resourceId: string,
  lockToken: string,
): Promise<boolean> {
  const lockKey = `lock:${resourceId}`;

  // Atomic compare-and-delete — prevents releasing another caller's lock
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(script, [lockKey], [lockToken]);
  return result === 1;
}

/**
 * Extend a lock's TTL while we still hold it.
 *
 * @param resourceId       - Same resource id
 * @param lockToken        - Token returned by acquireLock
 * @param additionalSeconds - Seconds to add
 */
export async function extendLock(
  resourceId: string,
  lockToken: string,
  additionalSeconds: number,
): Promise<boolean> {
  const lockKey = `lock:${resourceId}`;

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    else
      return 0
    end
  `;

  const result = await redis.eval(
    script,
    [lockKey],
    [lockToken, additionalSeconds],
  );
  return result === 1;
}
