import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export type RateLimitScope =
  | "login"
  | "signup"
  | "forgot-password"
  | "reset-password"
  | "search"
  | "admin"
  | "registration";

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export const RATE_LIMITS: Record<RateLimitScope, RateLimitConfig> = {
  login: { limit: 5, windowSeconds: 60 },
  signup: { limit: 5, windowSeconds: 3_600 },
  "forgot-password": { limit: 3, windowSeconds: 900 },
  "reset-password": { limit: 10, windowSeconds: 900 },
  search: { limit: 60, windowSeconds: 60 },
  admin: { limit: 30, windowSeconds: 60 },
  registration: { limit: 5, windowSeconds: 900 },
};

const ATOMIC_COUNTER_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

export async function checkRateLimit(
  scope: RateLimitScope,
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[scope];
  const now = Date.now();

  if (process.env.NODE_ENV === "development") {
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      resetAt: now + config.windowSeconds * 1000,
    };
  }

  const digest = hashIdentifier(identifier);
  const key = `ratelimit:${scope}:${digest}`;

  let count: number;
  let ttl: number;
  try {
    const [rawCount, rawTtl] = await redis.eval<[string], [number, number]>(
      ATOMIC_COUNTER_SCRIPT,
      [key],
      [String(config.windowSeconds)],
    );
    count = Number(rawCount);
    ttl = Number(rawTtl) > 0 ? Number(rawTtl) : config.windowSeconds;
  } catch (error) {
    console.error(`[rate-limit] Redis unavailable for ${scope}, failing open`, error);
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit,
      resetAt: now + config.windowSeconds * 1000,
    };
  }

  return {
    allowed: count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    resetAt: now + ttl * 1000,
  };
}

export function resolveRateLimitIdentifier(
  request: Request,
  userId?: string | null,
): string {
  if (userId) {
    return userId;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function enforceRateLimit(
  request: Request,
  scope: RateLimitScope,
  userId?: string | null,
): Promise<NextResponse | null> {
  const identifier = resolveRateLimitIdentifier(request, userId);
  const result = await checkRateLimit(scope, identifier);

  if (result.allowed) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
