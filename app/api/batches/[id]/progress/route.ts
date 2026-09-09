import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getVolumeCounter,
  restoreVolumeCounter,
} from "@/lib/orders/registration-counter";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";
import type { MarketplaceTier } from "@/lib/marketplace/types";

export const dynamic = "force-dynamic";

interface BatchRow {
  status: string;
}

interface TimelineRow {
  registration_closes_at: string;
}

interface TierRow {
  tier_number: number;
  min_volume: number;
  max_volume: number | null;
  price_per_unit: number;
}

interface RegistrationRow {
  quantity: number;
}

interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

interface SingleQuery<T> {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      single: () => PromiseLike<QueryResult<T>>;
    };
  };
}

interface ListQuery<T> {
  select: (columns: string) => {
    eq: (column: string, value: string) => PromiseLike<QueryResult<T[]>>;
  };
}

interface RegistrationListQuery {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      in: (column: string, values: string[]) => PromiseLike<QueryResult<RegistrationRow[]>>;
    };
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();
  const batchQuery = client.from("batches") as unknown as SingleQuery<BatchRow>;
  const { data: batch, error: batchError } = await batchQuery
    .select("status")
    .eq("id", id)
    .single();

  // Draft and otherwise unpublished batches must not be discoverable through
  // this public endpoint, even when a caller knows their UUID.
  if (batchError || !batch || batch.status !== "published") {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const timelineQuery = client.from("batch_timeline") as unknown as SingleQuery<TimelineRow>;
  const { data: timeline, error: timelineError } = await timelineQuery
    .select("registration_closes_at")
    .eq("batch_id", id)
    .single();
  if (timelineError || !timeline) {
    return NextResponse.json({ error: "Batch timeline not found" }, { status: 500 });
  }

  const tiersQuery = client.from("batch_tiers") as unknown as ListQuery<TierRow>;
  const { data: tierRows, error: tiersError } = await tiersQuery
    .select("tier_number,min_volume,max_volume,price_per_unit")
    .eq("batch_id", id);
  if (tiersError || !tierRows || tierRows.length === 0) {
    return NextResponse.json({ error: "Batch tiers not found" }, { status: 500 });
  }

  const tiers: MarketplaceTier[] = tierRows
    .map((tier) => ({
      tierNumber: Number(tier.tier_number),
      minVolume: Number(tier.min_volume),
      maxVolume: tier.max_volume === null ? null : Number(tier.max_volume),
      pricePerUnit: Number(tier.price_per_unit),
    }))
    .sort((a, b) => a.minVolume - b.minVolume);

  if (
    tiers.some(
      (tier) =>
        !Number.isFinite(tier.tierNumber) ||
        !Number.isFinite(tier.minVolume) ||
        (tier.maxVolume !== null && !Number.isFinite(tier.maxVolume)) ||
        !Number.isFinite(tier.pricePerUnit),
    )
  ) {
    return NextResponse.json({ error: "Invalid batch tiers" }, { status: 500 });
  }

  let registeredQuantity: number;
  try {
    const cachedQuantity = await getVolumeCounter(id);
    if (cachedQuantity !== null) {
      registeredQuantity = Math.max(0, cachedQuantity);
    } else {
      const adminClient = getAdminClient();
      const registrationsQuery = adminClient.from(
        "registrations",
      ) as unknown as RegistrationListQuery;
      const { data: registrations, error: registrationsError } =
        await registrationsQuery
          .select("quantity")
          .eq("batch_id", id)
          .in("status", ["registered", "pending_payment"]);
      if (registrationsError) throw registrationsError;

      registeredQuantity = (registrations ?? []).reduce(
        (total, registration) => {
          const quantity = Number(registration.quantity);
          return Number.isSafeInteger(quantity) && quantity > 0
            ? total + quantity
            : total;
        },
        0,
      );
      await restoreVolumeCounter(id, registeredQuantity);
    }
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    {
      batchId: id,
      status: batch.status,
      registeredQuantity,
      tiers,
      tierProgress: deriveTierProgress(tiers, registeredQuantity),
      registrationClosesAt: timeline.registration_closes_at,
      serverTime: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
