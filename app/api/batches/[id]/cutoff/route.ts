import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { apiError, apiSuccess } from "@/app/api/_lib/response";
import { runBatchCutoff } from "@/lib/batches/cutoff-runner";

export const dynamic = "force-dynamic";

/**
 * POST /api/batches/[id]/cutoff — picu penguncian harga tier (hybrid trigger).
 *
 * Tanpa body: timestamp selalu dari server (Date.now) agar tak bisa
 * dimanipulasi client. Idempoten — aman dipanggil berulang. Lazy hook di
 * route register/pay/batch-detail memanggil logika yang sama otomatis.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: batchId } = await params;
  if (!isUuid(batchId)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  let result;
  try {
    result = await runBatchCutoff(client, batchId, Date.now());
  } catch {
    return apiError("CUTOFF_FAILED", "Gagal mengunci harga batch.", 500);
  }

  if (!result.applied) {
    if (result.reason === "not_found") {
      return apiError("BATCH_NOT_FOUND", "Batch tidak ditemukan.", 404);
    }
    if (result.reason === "lock_busy") {
      return apiSuccess(
        { locked: false, reason: "lock_busy", batch_id: batchId },
        202,
      );
    }
    return apiSuccess({
      locked: false,
      reason: result.reason,
      batch_id: batchId,
    });
  }

  return apiSuccess({
    locked: true,
    batch_id: batchId,
    total_volume: result.totalVolume,
    locked_tier: result.tier.tier_number,
    locked_price: Number(result.tier.price_per_unit),
    affected: result.affected,
  });
}
