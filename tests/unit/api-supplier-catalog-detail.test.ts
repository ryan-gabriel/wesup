import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET, PATCH, DELETE } from "@/app/api/suppliers/batches/[id]/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);
const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const row = {
  id: BATCH_ID, supplier_name: "Supplier Bandung", title: "Beras Rojolele", description: "Beras untuk UMKM", category: "Makanan Siap Saji", min_quantity: 50,
  product_photo_url: "https://example.supabase.co/storage/v1/object/public/wesup-public/products/44444444-4444-4444-8444-444444444444/old.webp" as string | null, pickup_name: "Gudang Bandung", pickup_address: "Jl. Asia Afrika No. 1", latitude: -6.9175, longitude: 107.6191, status: "published",
  registration_opens_at: "2099-01-01T01:00:00.000Z", registration_closes_at: "2099-01-02T01:00:00.000Z", payment_opens_at: "2099-01-02T02:00:00.000Z", payment_closes_at: "2099-01-03T02:00:00.000Z", estimated_ready_at: "2099-01-04T02:00:00.000Z",
  tiers: [{ tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 75000 }, { tier_number: 2, min_volume: 50, max_volume: null, price_per_unit: 68000 }], registered_quantity: 0, participant_count: 0, paid_participant_count: 0, cancelled_reason: null, updated_at: "2098-01-01T00:00:00.000Z", created_at: "2098-01-01T00:00:00.000Z",
};
function payload() { return { title: row.title, category: row.category, description: row.description, targetQuantity: row.min_quantity, pickupName: row.pickup_name, pickupAddress: row.pickup_address, pickupLatitude: row.latitude, pickupLongitude: row.longitude, registrationOpensAt: row.registration_opens_at, registrationClosesAt: row.registration_closes_at, paymentOpensAt: row.payment_opens_at, paymentClosesAt: row.payment_closes_at, estimatedReadyAt: row.estimated_ready_at, tiers: row.tiers.map((tier) => ({ tierNumber: tier.tier_number, minimumQuantity: tier.min_volume, maximumQuantity: tier.max_volume, pricePerUnit: tier.price_per_unit })) }; }
function mockClient(currentRow = row) {
  const getUser = vi.fn(async () => ({ data: { user: { id: "33333333-3333-4333-8333-333333333333", email: "supplier@example.com" } }, error: null }));
  const single = vi.fn(async () => ({ data: { role: "supplier", status: "active", full_name: "Supplier" }, error: null }));
  const rpc = vi.fn(async (name: string) => name === "get_supplier_batch" ? { data: [currentRow], error: null } : { data: null, error: null });
  const remove = vi.fn(async () => ({ error: null }));
  const upload = vi.fn(async () => ({ data: { path: `products/${BATCH_ID}/new.webp` }, error: null }));
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/wesup-public/products/${BATCH_ID}/new.webp` } }));
  const storage = { from: vi.fn(() => ({ upload, remove, getPublicUrl })) };
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) }));
  const client = { auth: { getUser }, from, rpc, storage }; mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>); return { rpc, remove, upload };
}
function formRequest(action: "draft" | "publish" = "draft") { const form = new FormData(); form.set("action", action); form.set("payload", JSON.stringify(payload())); form.set("productPhoto", new File(["RIFFxxxxWEBP"], "new.webp", { type: "image/webp" })); return new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}`, { method: "PATCH", body: form }); }
describe("supplier catalog detail API", () => {
  beforeEach(() => mockGetServerClient.mockReset());
  it("loads supplier-owned detail through the RPC", async () => { const { rpc } = mockClient(); const response = await GET(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}`), { params: Promise.resolve({ id: BATCH_ID }) }); expect(response.status).toBe(200); await expect(response.json()).resolves.toEqual(expect.objectContaining({ item: expect.objectContaining({ id: BATCH_ID, targetQuantity: 50 }) })); expect(rpc).toHaveBeenCalledWith("get_supplier_batch", { p_batch_id: BATCH_ID }); });
  it("updates a published batch and removes the old photo after success", async () => { const { rpc, upload, remove } = mockClient(); const response = await PATCH(formRequest(), { params: Promise.resolve({ id: BATCH_ID }) }); expect(response.status).toBe(200); expect(upload).toHaveBeenCalledOnce(); expect(rpc).toHaveBeenCalledWith("update_supplier_batch", expect.objectContaining({ p_batch_id: BATCH_ID, p_min_quantity: 50 })); expect(remove).toHaveBeenCalledWith([`products/${BATCH_ID}/old.webp`]); });
  it("hard-deletes a draft through the delete RPC", async () => { const { rpc } = mockClient({ ...row, status: "draft", product_photo_url: null }); const response = await DELETE(new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}`, { method: "DELETE" }), { params: Promise.resolve({ id: BATCH_ID }) }); expect(response.status).toBe(200); expect(rpc).toHaveBeenCalledWith("delete_supplier_batch", { p_batch_id: BATCH_ID }); });
});