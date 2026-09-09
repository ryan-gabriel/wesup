import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { apiError, apiSuccess } from "@/app/api/_lib/response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";

export const dynamic = "force-dynamic";

/**
 * POST /api/batches/[id]/reconcile — Hit & Run auto-suspend (PRD 3.4).
 *
 * Lazy, on-demand: dipanggil supplier pemilik / admin setelah payment
 * window tutup (pasca rekonsiliasi Midtrans). Satu pemegang lock
 * mengeksekusi `apply_hit_and_run()`; sisanya reader (409).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: batchId } = await params;
  if (!isUuid(batchId)) {
    return apiError("INVALID_BATCH_ID", "Invalid batch id", 400);
  }

  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, [
      "supplier",
      "admin",
    ]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const limited = await enforceRateLimit(request, "admin", context.userId);
  if (limited) return limited;

  const lockToken = await acquireLock(`reconcile:${batchId}`, 60);
  if (!lockToken) {
    return apiError(
      "RECONCILE_IN_PROGRESS",
      "Batch sedang direkonsiliasi proses lain. Coba lagi.",
      409,
    );
  }

  try {
    const { data, error } = await client.rpc("apply_hit_and_run", {
      p_batch_id: batchId,
      p_ip_address: null,
      p_user_agent: null,
    });

    if (error) {
      if (/not found/i.test(error.message)) {
        return apiError("BATCH_NOT_FOUND", error.message, 404);
      }
      if (/still open/i.test(error.message)) {
        return apiError("PAYMENT_WINDOW_OPEN", error.message, 409);
      }
      return apiError("RECONCILE_FAILED", "Gagal mengeksekusi rekonsiliasi.", 500);
    }

    return apiSuccess(data);
  } finally {
    await releaseLock(`reconcile:${batchId}`, lockToken);
  }
}
