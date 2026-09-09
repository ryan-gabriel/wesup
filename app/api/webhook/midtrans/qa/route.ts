import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { redis } from "@/lib/redis";
import { apiError, apiSuccess } from "@/app/api/_lib/response";
import { WEBHOOK_DISABLED_KEY } from "@/lib/payments/midtrans";

export const dynamic = "force-dynamic";

const MAX_TTL_SECONDS = 86_400;

/** Kill-switch QA hanya hidup di non-production. */
function productionGuard(): NextResponse | null {
  if (process.env.APP_ENV === "production") {
    return apiError(
      "FORBIDDEN_ENV",
      "QA webhook control tidak tersedia di production.",
      403,
    );
  }
  return null;
}

async function currentState() {
  const flag = await redis.get(WEBHOOK_DISABLED_KEY);
  const ttl = await redis.ttl(WEBHOOK_DISABLED_KEY);
  return {
    disabled: flag !== null && flag !== undefined && flag !== "",
    ttl_seconds: typeof ttl === "number" && ttl > 0 ? ttl : null,
  };
}

/** GET — status kill-switch sinkronisasi webhook. */
export async function GET(): Promise<NextResponse> {
  const blocked = productionGuard();
  if (blocked) return blocked;

  const client = await getServerClient();
  try {
    await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }
  return apiSuccess(await currentState());
}

/**
 * POST — { mode: "disabled" | "enabled", ttl_seconds?: 1..86400 }.
 * Tanpa ttl = mati permanen sampai di-enable; dengan ttl = simulasi delay.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const blocked = productionGuard();
  if (blocked) return blocked;

  const client = await getServerClient();
  try {
    await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("INVALID_BODY", "Invalid JSON body", 400);
  }

  if (body.mode === "enabled") {
    await redis.del(WEBHOOK_DISABLED_KEY);
    return apiSuccess(await currentState());
  }

  if (body.mode === "disabled") {
    const ttl = body.ttl_seconds;
    if (ttl !== undefined) {
      if (typeof ttl !== "number" || !Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TTL_SECONDS) {
        return apiError("INVALID_TTL", "ttl_seconds harus 1..86400", 400);
      }
      await redis.set(WEBHOOK_DISABLED_KEY, "1", { ex: ttl });
    } else {
      await redis.set(WEBHOOK_DISABLED_KEY, "1");
    }
    return apiSuccess(await currentState());
  }

  return apiError("INVALID_MODE", 'mode harus "enabled" atau "disabled"', 400);
}
