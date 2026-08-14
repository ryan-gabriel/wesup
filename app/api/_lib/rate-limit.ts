import { redis } from "@/lib/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * Sliding-window rate limiter using Redis INCR + EXPIRE.
 *
 * @param identifier - Unique key (userId or IP)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowSeconds - Window duration in seconds
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowSeconds: number = 60,
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (current > maxRequests) {
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: ttl > 0 ? ttl : windowSeconds,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - current,
  };
}
