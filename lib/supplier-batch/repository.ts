import { supabase } from "@/lib/supabase/client";
import { mapSupplierBatchRow, type SupplierBatchRow } from "./map";
import type { SupplierBatchRepository } from "./types";

const BATCH_COLUMNS =
  "id, title, description, category, min_quantity, product_photo_url, pickup_address, latitude, longitude, status, cancelled_reason, updated_at, batch_tiers(tier_number, min_volume, max_volume, price_per_unit), batch_timeline(registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at)";

async function fetchCounts(batchId: string) {
  const [participants, paid, counter] = await Promise.all([
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batchId),
    supabase
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("status", "paid"),
    supabase
      .from("registration_counters")
      .select("current_count")
      .eq("batch_id", batchId)
      .maybeSingle(),
  ]);
  return {
    participantCount: participants.count ?? 0,
    paidParticipantCount: paid.count ?? 0,
    registeredQuantity: counter.data?.current_count ?? 0,
  };
}

export const supplierBatchRepository: SupplierBatchRepository = {
  async getById(id) {
    const { data, error } = await supabase
      .from("batches")
      .select(BATCH_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("Gagal memuat katalog.");
    if (!data || !data.batch_timeline) return null;
    const counts = await fetchCounts(id);
    return mapSupplierBatchRow(data as unknown as SupplierBatchRow, counts);
  },

  async cancel(id, { reason }) {
    const trimmed = reason.trim();
    if (trimmed === "") {
      throw new Error("Alasan pembatalan wajib diisi.");
    }
    const res = await fetch(`/api/suppliers/batches/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: trimmed }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Gagal membatalkan katalog.");
    }
    const batch = await this.getById(id);
    if (!batch) throw new Error("Gagal memuat katalog.");
    return batch;
  },
};
