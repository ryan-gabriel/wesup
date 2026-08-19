import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

export type RateLimitScope = "email" | "registration";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const LIMITS: Record<RateLimitScope, { limit: number; windowSeconds: number }> = {
  email: { limit: 10, windowSeconds: 60 },
  registration: { limit: 5, windowSeconds: 15 * 60 },
};

const ATOMIC_COUNTER_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

export async function consumeSupplierRegistrationLimit(
  scope: RateLimitScope,
  identifier: string,
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "development") {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const config = LIMITS[scope];
  const digest = createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
  const key = `supplier-register:${scope}:${digest}`;
  const result = await redis.eval<[string], [number, number]>(
    ATOMIC_COUNTER_SCRIPT,
    [key],
    [String(config.windowSeconds)],
  );
  const [count, ttl] = Array.isArray(result) ? result : [Number(result), config.windowSeconds];
  return {
    allowed: Number(count) <= config.limit,
    retryAfterSeconds: Math.max(1, Number(ttl) || config.windowSeconds),
  };
}

export { ATOMIC_COUNTER_SCRIPT };
