import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/suppliers/dashboard/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);
const batch = { id: "44444444-4444-4444-8444-444444444444", supplier_name: "Supplier Bandung", title: "Beras", description: "Lengkap", category: "Makanan Siap Saji", min_quantity: 20, product_photo_url: "https://x/wesup-public/products/id/a.webp", pickup_name: "Gudang", pickup_address: "Bandung", latitude: -6.9, longitude: 107.6, status: "published", registration_opens_at: "2099-01-01T00:00:00.000Z", registration_closes_at: "2099-01-02T00:00:00.000Z", payment_opens_at: "2099-01-02T01:00:00.000Z", payment_closes_at: "2099-01-03T00:00:00.000Z", estimated_ready_at: "2099-01-04T00:00:00.000Z", tiers: [{ tier_number: 1, min_volume: 1, max_volume: null, price_per_unit: 10 }], registered_quantity: 7, participant_count: 2, paid_participant_count: 1, cancelled_reason: null, updated_at: "2099-01-01T00:00:00.000Z", created_at: "2099-01-01T00:00:00.000Z" };
function mockSupplierClient(ratingCount = 3) {
  const rpc = vi.fn(async (name: string) => name === "list_supplier_batches" ? { data: [batch], error: null } : { data: [{ supplier_name: "Supplier Bandung", supplier_status: "approved", active_batch_count: 2, total_participant_count: 11, collected_revenue: "650000", ready_to_disburse: "125000", average_rating: "4.5", rating_count: ratingCount }], error: null });
  const client = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: "33333333-3333-4333-8333-333333333333" } }, error: null })) }, from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "supplier", status: "active", full_name: "Supplier" }, error: null })) })) })) })), rpc };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>); return rpc;
}
describe("GET /api/suppliers/dashboard", () => {
  beforeEach(() => mockGetServerClient.mockReset());
  it("returns real full owned batch details instead of partial dashboard JSON", async () => {
    const rpc = mockSupplierClient(); const response = await GET(); expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ summary: expect.objectContaining({ ratingAverage: 4.5 }), recentBatches: [expect.objectContaining({ id: batch.id, description: "Lengkap", imageUrl: batch.product_photo_url, tiers: [expect.objectContaining({ pricePerUnit: 10 })], timeline: expect.objectContaining({ paymentClosesAt: batch.payment_closes_at }), pickup: expect.objectContaining({ name: "Gudang" }), registeredQuantity: 7, paidParticipantCount: 1 })] }));
    expect(rpc).toHaveBeenCalledWith("list_supplier_batches", { p_status: null, p_query: null });
  });
  it("returns null for an unrated supplier", async () => {
    mockSupplierClient(0); const response = await GET(); expect((await response.json()).summary.ratingAverage).toBeNull();
  });
});
