import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { validateBusinessPhoto } from "@/lib/supplier-registration/contracts";
import { mapSupplierBatchRow, parseSupplierCatalogPayload, type SupplierBatchRpcRow, type SupplierCatalogPayload } from "@/lib/supplier-catalog/api";
import { validateCatalogMutation } from "@/lib/supplier-catalog/validation";

export const dynamic = "force-dynamic";

type CatalogAction = "draft" | "publish";

class CatalogDetailError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409 | 500, message: string, public readonly code = "SUPPLIER_CATALOG_REQUEST_FAILED") {
    super(message);
    this.name = "CatalogDetailError";
  }
}

interface CatalogClient {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from: (bucket: "wesup-public") => {
      upload: (path: string, file: File, options: { contentType: string; cacheControl: string; upsert: boolean }) => PromiseLike<{ data: { path: string } | null; error: { message?: string } | null }>;
      remove: (paths: string[]) => PromiseLike<{ error: { message?: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

function clientOf(value: unknown) { return value as CatalogClient; }

async function authorize() {
  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (error) {
    return { client: null, response: toAuthResponse(error) };
  }
  return { client: clientOf(client), response: null };
}

function toError(error: unknown): CatalogDetailError {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "42501") return new CatalogDetailError(403, "Akses supplier ditolak.", "SUPPLIER_CATALOG_FORBIDDEN");
  if (code === "P0002") return new CatalogDetailError(404, "Katalog tidak ditemukan.", "SUPPLIER_CATALOG_NOT_FOUND");
  if (code === "22023") return new CatalogDetailError(400, "Data katalog tidak valid.", "SUPPLIER_CATALOG_INVALID");
  if (code === "55000") return new CatalogDetailError(409, "Perubahan katalog tidak dapat dilakukan.", "SUPPLIER_CATALOG_CONFLICT");
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  if (/approval|supplier/i.test(message) && /required|only|permission/i.test(message)) return new CatalogDetailError(403, "Akun supplier belum dapat menerbitkan katalog.", "SUPPLIER_CATALOG_NOT_APPROVED");
  if (/not found|read-only|locked|participant|publishable/i.test(message)) return new CatalogDetailError(409, message || "Perubahan katalog tidak dapat dilakukan.", "SUPPLIER_CATALOG_CONFLICT");
  if (/required|invalid|positive|future|linear|tier|location|photo|category/i.test(message)) return new CatalogDetailError(400, message || "Data katalog tidak valid.", "SUPPLIER_CATALOG_INVALID");
  return new CatalogDetailError(500, "Katalog belum dapat diproses.");
}

function errorResponse(error: unknown) {
  if (error instanceof CatalogDetailError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("[suppliers/batches/id] request failed", error);
  return NextResponse.json({ error: "Katalog belum dapat diproses.", code: "SUPPLIER_CATALOG_REQUEST_FAILED" }, { status: 500 });
}

async function readBatch(client: CatalogClient, id: string): Promise<SupplierBatchRpcRow | null> {
  const result = await client.rpc("get_supplier_batch", { p_batch_id: id });
  if (result.error) throw toError(result.error);
  return (Array.isArray(result.data) ? result.data[0] : null) as SupplierBatchRpcRow | null;
}

function payloadArgs(payload: SupplierCatalogPayload) {
  return {
    p_title: payload.title.trim(),
    p_description: payload.description.trim(),
    p_category: payload.category,
    p_min_quantity: payload.targetQuantity,
    p_pickup_name: payload.pickupName.trim(),
    p_pickup_address: payload.pickupAddress.trim(),
    p_latitude: payload.pickupLatitude,
    p_longitude: payload.pickupLongitude,
    p_registration_opens_at: new Date(payload.registrationOpensAt).toISOString(),
    p_registration_closes_at: new Date(payload.registrationClosesAt).toISOString(),
    p_payment_opens_at: new Date(payload.paymentOpensAt).toISOString(),
    p_payment_closes_at: new Date(payload.paymentClosesAt).toISOString(),
    p_estimated_ready_at: new Date(payload.estimatedReadyAt).toISOString(),
    p_tiers: payload.tiers.map((tier) => ({ tier_number: tier.tierNumber, min_volume: tier.minimumQuantity, max_volume: tier.maximumQuantity, price_per_unit: tier.pricePerUnit })),
  };
}

async function parseForm(request: Request, fallback: CatalogAction) {
  let form: FormData;
  try { form = await request.formData(); } catch { throw new CatalogDetailError(400, "Payload katalog tidak valid.", "SUPPLIER_CATALOG_INVALID"); }
  if (form.has("supplierId")) throw new CatalogDetailError(400, "supplierId tidak boleh dikirim.", "SUPPLIER_CATALOG_INVALID");
  const raw = form.get("payload");
  if (typeof raw !== "string") throw new CatalogDetailError(400, "Payload katalog wajib diisi.", "SUPPLIER_CATALOG_INVALID");
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { throw new CatalogDetailError(400, "Payload katalog bukan JSON yang valid.", "SUPPLIER_CATALOG_INVALID"); }
  const payload = parseSupplierCatalogPayload(decoded);
  if (!payload) throw new CatalogDetailError(400, "Periksa kembali data katalog.", "SUPPLIER_CATALOG_INVALID");
  const action = form.get("action") === "publish" || form.get("action") === "draft" ? form.get("action") as CatalogAction : fallback;
  const entry = form.get("productPhoto");
  const productPhoto = entry instanceof File && entry.size > 0 ? entry : null;
  if (productPhoto) {
    const photoError = await validateBusinessPhoto(productPhoto);
    if (photoError) throw new CatalogDetailError(400, photoError, "SUPPLIER_CATALOG_INVALID");
  }
  return { payload, action, productPhoto };
}

function validatePayload(payload: SupplierCatalogPayload, allowPastTimeline: boolean) {
  const result = validateCatalogMutation({ ...payload, productPhotoUrl: null }, { allowPastTimeline });
  if (!result.ok) throw new CatalogDetailError(400, Object.values(result.fieldErrors)[0] ?? "Data katalog tidak valid.", "SUPPLIER_CATALOG_INVALID");
}

async function upload(client: CatalogClient, id: string, file: File) {
  const path = `products/${id}/${randomUUID()}.webp`;
  const result = await client.storage.from("wesup-public").upload(path, file, { contentType: "image/webp", cacheControl: "3600", upsert: false });
  if (result.error || !result.data) throw new CatalogDetailError(500, "Foto produk belum dapat diunggah.", "SUPPLIER_CATALOG_UPLOAD_FAILED");
  return { path: result.data.path, url: client.storage.from("wesup-public").getPublicUrl(result.data.path).data.publicUrl };
}

function pathFromUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const marker = "/wesup-public/";
  const index = value.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(value.slice(index + marker.length));
}

async function cleanupPhoto(client: CatalogClient, batchId: string, path: string | null, phase: "old_photo" | "rollback" | "delete") {
  if (!path) return { ok: true as const };
  try { const { error } = await client.storage.from("wesup-public").remove([path]); if (!error) return { ok: true as const }; console.error("[suppliers/batches/id] storage cleanup failed", { batchId, path, phase, code: "STORAGE_REMOVE_FAILED", message: error.message ?? "storage removal failed" }); } catch (error) { console.error("[suppliers/batches/id] storage cleanup failed", { batchId, path, phase, code: "STORAGE_REMOVE_EXCEPTION", message: error instanceof Error ? error.message : String(error) }); }
  return { ok: false as const };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  try {
    const row = await readBatch(auth.client!, id);
    if (!row) return NextResponse.json({ error: "Katalog tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ item: mapSupplierBatchRow(row) });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  let uploadedPath: string | null = null;
  let mutationCommitted = false;
  try {
    const existing = await readBatch(auth.client!, id);
    if (!existing) return NextResponse.json({ error: "Katalog tidak ditemukan." }, { status: 404 });
    const existingStatus = String(existing.status ?? "").toLowerCase();
    if (!["draft", "published"].includes(existingStatus)) throw new CatalogDetailError(409, "Katalog ini sudah tidak dapat diedit.", "SUPPLIER_CATALOG_CONFLICT");
    const { payload, action, productPhoto } = await parseForm(request, "draft");
    validatePayload(payload, existingStatus === "published");
    if (action === "publish" && existingStatus === "draft" && !productPhoto && typeof existing.product_photo_url !== "string") {
      throw new CatalogDetailError(400, "Foto produk wajib diunggah sebelum menerbitkan.", "SUPPLIER_CATALOG_INVALID");
    }
    const uploaded = productPhoto ? await upload(auth.client!, id, productPhoto) : null;
    uploadedPath = uploaded?.path ?? null;
    const mutation = action === "publish" && existingStatus === "draft" ? "update_and_publish_supplier_batch" : "update_supplier_batch";
    const update = await auth.client!.rpc(mutation, { ...payloadArgs(payload), p_batch_id: id, p_product_photo_url: uploaded?.url ?? (typeof existing.product_photo_url === "string" ? existing.product_photo_url : null) });
    if (update.error) throw toError(update.error);
    mutationCommitted = true;
    if (uploaded && existing.product_photo_url !== uploaded.url) await cleanupPhoto(auth.client!, id, pathFromUrl(existing.product_photo_url), "old_photo");
    const row = await readBatch(auth.client!, id);
    if (!row) throw new CatalogDetailError(500, "Detail katalog belum tersedia.");
    return NextResponse.json({ item: mapSupplierBatchRow(row) });
  } catch (error) {
    if (uploadedPath && !mutationCommitted) {
      const cleanup = await cleanupPhoto(auth.client!, id, uploadedPath, "rollback");
      if (!cleanup.ok) return NextResponse.json({ error: "Katalog belum dapat diproses.", code: "SUPPLIER_CATALOG_CLEANUP_FAILED" }, { status: 500 });
    }
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  try {
    const existing = await readBatch(auth.client!, id);
    if (!existing) return NextResponse.json({ error: "Katalog tidak ditemukan." }, { status: 404 });
    if (String(existing.status ?? "").toLowerCase() !== "draft") throw new CatalogDetailError(409, "Hanya draft kosong yang dapat dihapus.", "SUPPLIER_CATALOG_CONFLICT");
    const result = await auth.client!.rpc("delete_supplier_batch", { p_batch_id: id });
    if (result.error) throw toError(result.error);
    await cleanupPhoto(auth.client!, id, pathFromUrl(existing.product_photo_url), "old_photo");
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
