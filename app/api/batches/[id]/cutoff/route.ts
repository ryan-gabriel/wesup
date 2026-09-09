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
import {
  acquireCutoffLock,
  releaseCutoffLock,
  resetVolumeCounter,
} from "@/lib/orders/registration-counter";

export const dynamic = "force-dynamic";

/**
 * POST /api/batches/[id]/cutoff — Volume-Limiting Gatekeeper (PRD 3.1/3.2).
 *
 * Tanpa body: hanya supplier pemilik / admin (ditegakkan juga di RPC).
 * Satu pemegang lock Redis mengeksekusi `cut_off_batch()` (idempoten,
 * fallback Tier 1, audit); yang kalah lock jadi reader (409).
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

  const lock = await acquireCutoffLock(batchId);
  if (!lock.acquired) {
    return apiError(
      "CUTOFF_IN_PROGRESS",
      "Batch sedang dikunci proses lain. Coba lagi.",
      409,
    );
  }

  try {
    const { error } = await client.rpc("cut_off_batch", {
      p_batch_id: batchId,
      p_ip_address: null,
      p_user_agent: null,
    });

    if (error) {
      if (/already closed|not found/i.test(error.message)) {
        return apiError("BATCH_ALREADY_CLOSED", error.message, 409);
      }
      return apiError("CUTOFF_FAILED", "Gagal mengunci harga batch.", 500);
    }

    await resetVolumeCounter(batchId);
    return apiSuccess({ locked: true, batch_id: batchId });
  } finally {
    await releaseCutoffLock(batchId, lock.token);
  }
}
