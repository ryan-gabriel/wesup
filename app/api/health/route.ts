import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — Health check endpoint (public).
 *
 * Checks connectivity to Supabase (database) and Upstash Redis.
 */
export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number }> = {};
  let healthy = true;

  // Check Supabase
  const supaStart = Date.now();
  try {
    const client = await getServerClient();
    const { error } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    checks.supabase = {
      status: error ? "error" : "ok",
      latency_ms: Date.now() - supaStart,
    };
    if (error) healthy = false;
  } catch {
    checks.supabase = { status: "error", latency_ms: Date.now() - supaStart };
    healthy = false;
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const pong = await redis.ping();
    checks.redis = {
      status: pong === "PONG" ? "ok" : "error",
      latency_ms: Date.now() - redisStart,
    };
    if (pong !== "PONG") healthy = false;
  } catch {
    checks.redis = { status: "error", latency_ms: Date.now() - redisStart };
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
