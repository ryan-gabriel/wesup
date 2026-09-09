import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  evaluateRegistrationWindow,
  type BatchTimeline,
  type Tier,
} from "@/lib/orders/time-gatekeeper";
import { adjustVolumeCounter } from "@/lib/orders/registration-counter";

export const dynamic = "force-dynamic";

interface RegistrationBody {
  batchId?: unknown;
  quantity?: unknown;
  consentLat?: unknown;
  consentLng?: unknown;
}

export async function POST(req: Request) {
  const client = await getServerClient();

  let authCtx: AuthContext;
  try {
    authCtx = await requireRole(client as unknown as AuthClient, ["umkm"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const limited = await enforceRateLimit(req, "registration", authCtx.userId);
  if (limited) return limited;

  const body = (await parseJsonBody(req)) as RegistrationBody | null;
  if (
    !body ||
    typeof body.batchId !== "string" ||
    !isUuid(body.batchId) ||
    typeof body.quantity !== "number" ||
    !Number.isSafeInteger(body.quantity) ||
    body.quantity <= 0
  ) {
    return NextResponse.json({ error: "Invalid registration payload" }, { status: 400 });
  }

  const batchId = body.batchId;
  const quantity = body.quantity;
  const consentLat =
    typeof body.consentLat === "number" ? body.consentLat : null;
  const consentLng =
    typeof body.consentLng === "number" ? body.consentLng : null;

  const batchQuery = client.from("batches") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => { single: () => PromiseLike<{ data: { status: string } | null; error: Error | null }> };
    };
  };
  const { data: batch, error: batchErr } = await batchQuery
    .select("status")
    .eq("id", batchId)
    .single();
  if (batchErr || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const timelineQuery = client.from("batch_timeline") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => { single: () => PromiseLike<{ data: BatchTimeline | null; error: Error | null }> };
    };
  };
  const { data: timeline, error: timelineErr } = await timelineQuery
    .select("*")
    .eq("batch_id", batchId)
    .single();
  if (timelineErr || !timeline) {
    return NextResponse.json({ error: "Batch timeline not found" }, { status: 500 });
  }

  const gate = evaluateRegistrationWindow(
    timeline,
    new Date().toISOString(),
    batch.status as never,
  );
  if (!gate.allowed) {
    const message =
      gate.reason === "not_open"
        ? "Pendaftaran belum dibuka"
        : gate.reason === "closed"
          ? "Pendaftaran telah ditutup"
          : "Penawaran tidak tersedia";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const tiersQuery = client.from("batch_tiers") as never as {
    select: (cols: string) => {
      eq: (col: string, v: string) => PromiseLike<{ data: Tier[] | null; error: Error | null }>;
    };
  };
  const { data: tiers, error: tiersErr } = await tiersQuery
    .select("tier_number,min_volume,max_volume,price_per_unit")
    .eq("batch_id", batchId);
  if (tiersErr || !tiers || tiers.length === 0) {
    return NextResponse.json({ error: "Batch tiers not found" }, { status: 500 });
  }
  const maxVolume = tiers.reduce<number>(
    (max, t) => (t.max_volume === null ? max : Math.max(max, t.max_volume)),
    0,
  );
  if (maxVolume > 0 && quantity > maxVolume) {
    return NextResponse.json(
      { error: "Quantity exceeds batch tier maximum volume" },
      { status: 400 },
    );
  }

  let newCount: number;
  try {
    newCount = await adjustVolumeCounter(batchId, quantity);
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const registrations = client.from("registrations");
  const { data: inserted, error: insertErr } = await (registrations as never as {
    insert: (row: never) => {
      select: (columns: string) => {
        single: () => PromiseLike<{ data: { id: string } | null; error: Error | null }>;
      };
    };
  }).insert({
    batch_id: batchId,
    umkm_id: authCtx.userId,
    quantity,
    consented_at: new Date().toISOString(),
    consent_latitude: consentLat,
    consent_longitude: consentLng,
    status: "registered",
  } as never).select("id").single();

  if (insertErr && isDuplicateKeyError(insertErr)) {
    await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json(
      { error: "Anda sudah terdaftar pada penawaran ini" },
      { status: 409 },
    );
  }
  if (insertErr) {
    await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (!inserted) {
    await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, count: newCount, registrationId: inserted?.id ?? null },
    { status: 201 },
  );
}

function isDuplicateKeyError(
  error: { code?: string; message?: string },
): boolean {
  return error.code === "23505" || /duplicate/i.test(error.message ?? "");
}
