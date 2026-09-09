import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { redis } from "@/lib/redis";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";
import {
  ensureBatchCutoff,
  type CutoffDeps,
  type CutoffRegistration,
  type CutoffResult,
  type CutoffTier,
} from "@/lib/batches/cutoff";

type Client = SupabaseClient<Database>;

interface CutoffBatchRow {
  status: string;
  batch_timeline: { registration_closes_at: string } | Array<{ registration_closes_at: string }> | null;
  batch_tiers: CutoffTier[] | null;
}

/**
 * Eksekusi cutoff dengan adapter Supabase + Redis asli.
 * Dipakai endpoint POST /api/batches/[id]/cutoff dan lazy hook di
 * route register / pay / batch-detail.
 */
export async function runBatchCutoff(
  client: Client,
  batchId: string,
  nowMs: number,
): Promise<CutoffResult> {
  const deps: CutoffDeps = {
    loadBatch: async (id) => {
      const { data, error } = await client
        .from("batches")
        .select(
          "status, batch_timeline(registration_closes_at), batch_tiers(tier_number, min_volume, max_volume, price_per_unit)",
        )
        .eq("id", id)
        .single();
      if (error || !data) return null;
      const row = data as unknown as CutoffBatchRow;
      const timeline = Array.isArray(row.batch_timeline)
        ? row.batch_timeline[0]
        : row.batch_timeline;
      if (!timeline) return null;
      return {
        status: row.status,
        closesAt: timeline.registration_closes_at,
        tiers: (row.batch_tiers ?? []) as CutoffTier[],
      };
    },
    getVolume: async (id) => {
      const cached = await redis.get<number>(`batch_counter:${id}`);
      return typeof cached === "number" ? cached : null;
    },
    countRegistrations: async (id) => {
      const { count } = await client
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", id);
      return count ?? 0;
    },
    listPendingRegistrations: async (id) => {
      const { data, error } = await client
        .from("registrations")
        .select("id, quantity")
        .eq("batch_id", id)
        .eq("status", "registered");
      if (error || !data) return [];
      return data as CutoffRegistration[];
    },
    acquireLock: () => acquireLock(`batch_cutoff:${batchId}`, 30),
    releaseLock: (token) => releaseLock(`batch_cutoff:${batchId}`, token),
    commitLock: async (id, tier, regs) => {
      const price = Number(tier.price_per_unit);
      // Registrasi dulu, batch terakhir — crash di tengah tetap bisa
      // dilanjutkan pemicu berikutnya (update guarded status='registered').
      for (const reg of regs) {
        const { error } = await client
          .from("registrations")
          .update({
            locked_tier_number: tier.tier_number,
            locked_price_per_unit: price,
            final_amount: price * reg.quantity,
            status: "pending_payment",
          })
          .eq("id", reg.id)
          .eq("status", "registered");
        if (error) throw new Error(`Failed to lock registration ${reg.id}`);
      }
      const { error: batchError } = await client
        .from("batches")
        .update({ status: "closed" })
        .eq("id", id)
        .eq("status", "published");
      if (batchError) throw new Error("Failed to close batch");
      return regs.length;
    },
  };

  const result = await ensureBatchCutoff(deps, batchId, nowMs);

  if (result.applied) {
    // Mirror counter persisten untuk recovery (best-effort, abaikan gagal)
    await client
      .from("registration_counters")
      .upsert(
        { batch_id: batchId, current_count: result.totalVolume },
        { onConflict: "batch_id" },
      );
  }
  return result;
}

/** Lazy hook untuk route lain: picu cutoff, telan error (reader tetap jalan). */
export async function triggerLazyCutoff(
  client: Client,
  batchId: string,
  nowMs: number,
): Promise<CutoffResult | undefined> {
  try {
    return await runBatchCutoff(client, batchId, nowMs);
  } catch {
    // ponytail: cutoff best-effort — request baca tidak boleh mati karenanya
    return undefined;
  }
}
