import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerClient } from "@/lib/supabase/server";
import { POST as createBatch, GET as listBatches } from "@/app/api/suppliers/batches/route";

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));
const mockGetServerClient = vi.mocked(getServerClient);
const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

const row = {
  id: BATCH_ID,
  supplier_name: "Supplier Bandung",
  title: "Beras Rojolele",
  description: "Beras untuk UMKM",
  category: "Makanan Siap Saji",
  min_quantity: 50,
  product_photo_url: "https://example.supabase.co/storage/v1/object/public/wesup-public/products/id.webp",
  pickup_name: "Gudang Bandung",
  pickup_address: "Jl. Asia Afrika No. 1",
  latitude: -6.9175,
  longitude: 107.6191,
  status: "published",
  registration_opens_at: "2099-01-01T01:00:00.000Z",
  registration_closes_at: "2099-01-02T01:00:00.000Z",
  payment_opens_at: "2099-01-02T02:00:00.000Z",
  payment_closes_at: "2099-01-03T02:00:00.000Z",
  estimated_ready_at: "2099-01-04T02:00:00.000Z",
  tiers: [
    { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 75000 },
    { tier_number: 2, min_volume: 50, max_volume: null, price_per_unit: 68000 },
  ],
  registered_quantity: 0,
  participant_count: 0,
  paid_participant_count: 0,
  cancelled_reason: null,
  updated_at: "2098-01-01T00:00:00.000Z",
  created_at: "2098-01-01T00:00:00.000Z",
};

function payload() {
  return {
    title: "Beras Rojolele",
    category: "Makanan Siap Saji",
    description: "Beras untuk UMKM",
    targetQuantity: 50,
    pickupName: "Gudang Bandung",
    pickupAddress: "Jl. Asia Afrika No. 1",
    pickupLatitude: -6.9175,
    pickupLongitude: 107.6191,
    registrationOpensAt: "2099-01-01T01:00:00.000Z",
    registrationClosesAt: "2099-01-02T01:00:00.000Z",
    paymentOpensAt: "2099-01-02T02:00:00.000Z",
    paymentClosesAt: "2099-01-03T02:00:00.000Z",
    estimatedReadyAt: "2099-01-04T02:00:00.000Z",
    tiers: [
      { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 49, pricePerUnit: 75000 },
      { tierNumber: 2, minimumQuantity: 50, maximumQuantity: null, pricePerUnit: 68000 },
    ],
  };
}

function mockSupplierClient(
  rpcData: unknown = row,
  options: { user?: { id: string; email: string } | null; profile?: { role: string; status: string }; uploadError?: string } = {},
) {
  const getUser = vi.fn(async () => ({ data: { user: options.user === undefined ? { id: SUPPLIER_ID, email: "supplier@example.com" } : options.user } , error: null }));
  const single = vi.fn(async () => ({ data: { role: options.profile?.role ?? "supplier", status: options.profile?.status ?? "active", full_name: "Supplier" }, error: null }));
  const rpc = vi.fn(async (name: string) => {
    if (name === "create_supplier_batch") return { data: BATCH_ID, error: null };
    if (name === "get_supplier_batch") return { data: [rpcData], error: null };
    if (name === "list_supplier_batches") return { data: [rpcData], error: null };
    return { data: null, error: null };
  });
  const upload = vi.fn(async () => options.uploadError
    ? { data: null, error: { message: options.uploadError } }
    : { data: { path: `products/${BATCH_ID}/photo.webp` }, error: null });
  const remove = vi.fn(async () => ({ error: null }));
  const getPublicUrl = vi.fn(() => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/wesup-public/products/${BATCH_ID}/photo.webp` } }));
  const storage = { from: vi.fn(() => ({ upload, getPublicUrl, remove })) };
  const from = vi.fn((table: string) => table === "profiles"
    ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) }
    : { select: vi.fn() });
  const client = { auth: { getUser }, from, rpc, storage };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, rpc, upload, remove };
}

function createRequest(action = "publish") {
  const form = new FormData();
  form.set("action", action);
  form.set("payload", JSON.stringify(payload()));
  if (action === "publish") form.set("productPhoto", new File(["RIFFxxxxWEBP"], "product.webp", { type: "image/webp" }));
  return new NextRequest("http://localhost/api/suppliers/batches", { method: "POST", body: form });
}

describe("supplier catalog API", () => {
  beforeEach(() => mockGetServerClient.mockReset());

  it("creates, uploads, publishes, and returns a real batch", async () => {
    const { rpc, upload } = mockSupplierClient();
    const response = await createBatch(createRequest("publish"));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.item.id).toBe(BATCH_ID);
    expect(rpc).toHaveBeenCalledWith("create_supplier_batch", expect.objectContaining({ p_min_quantity: 50 }));
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^products/${BATCH_ID}/`)), expect.any(File), expect.objectContaining({ contentType: "image/webp" }));
    expect(rpc).toHaveBeenCalledWith("publish_supplier_batch", expect.objectContaining({ p_batch_id: BATCH_ID, p_product_photo_url: expect.stringMatching(/^https:\/\//) }));
  });

  it("rejects malformed payload before calling the database", async () => {
    const { rpc } = mockSupplierClient();
    const form = new FormData();
    form.set("action", "publish");
    form.set("payload", "not-json");
    const response = await createBatch(new NextRequest("http://localhost/api/suppliers/batches", { method: "POST", body: form }));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the supplier-owned real list and status counts", async () => {
    const { rpc } = mockSupplierClient();
    const response = await listBatches(new NextRequest("http://localhost/api/suppliers/batches?q=beras"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ items: [expect.objectContaining({ id: BATCH_ID })] }));
    expect(rpc).toHaveBeenCalledWith("list_supplier_batches", { p_status: null, p_query: "beras" });
  });
  it("returns 401 for an unauthenticated request", async () => {
    mockSupplierClient(row, { user: null });
    const response = await listBatches(new NextRequest("http://localhost/api/suppliers/batches"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for a pending supplier", async () => {
    mockSupplierClient(row, { profile: { role: "supplier", status: "pending" } });
    const response = await listBatches(new NextRequest("http://localhost/api/suppliers/batches"));
    expect(response.status).toBe(403);
  });

  it("rolls back the draft when storage upload fails", async () => {
    const { rpc, remove } = mockSupplierClient(row, { uploadError: "storage unavailable" });
    const response = await createBatch(createRequest("publish"));
    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledWith("delete_supplier_batch", { p_batch_id: BATCH_ID });
    expect(remove).not.toHaveBeenCalled();
  });

  it("logs structured storage context when upload fails", async () => {
    const { rpc } = mockSupplierClient(row, { uploadError: "storage unavailable" });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await createBatch(createRequest("publish"));
      expect(response.status).toBe(500);
      expect(consoleError).toHaveBeenCalledWith(
        "[suppliers/batches] product photo upload failed",
        expect.objectContaining({
          batchId: BATCH_ID,
          path: expect.stringMatching(new RegExp(`^products/${BATCH_ID}/`)),
          message: "storage unavailable",
        }),
      );
      expect(rpc).not.toHaveBeenCalledWith("publish_supplier_batch", expect.anything());
    } finally {
      consoleError.mockRestore();
    }
  });

  it("rejects separate multipart supplierId", async () => {
    const { rpc } = mockSupplierClient(); const form = new FormData(); form.set("action", "draft"); form.set("payload", JSON.stringify(payload())); form.set("supplierId", "attacker");
    expect((await createBatch(new NextRequest("http://localhost/api/suppliers/batches", { method: "POST", body: form }))).status).toBe(400); expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts CANCELLED_BY_SUPPLIER filter compatibility", async () => {
    mockSupplierClient();
    const response = await listBatches(new NextRequest("http://localhost/api/suppliers/batches?status=cancelled_by_supplier"));
    expect(response.status).toBe(200); expect((await response.json()).items).toEqual([]);
  });});
