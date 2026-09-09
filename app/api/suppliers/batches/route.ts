import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { validateBusinessPhoto } from "@/lib/supplier-registration/contracts";
import { mapSupplierBatchRow, parseSupplierCatalogPayload, type SupplierBatchRpcRow, type SupplierCatalogPayload } from "@/lib/supplier-catalog/api";
import { validateCatalogMutation } from "@/lib/supplier-catalog/validation";
import type { BatchStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type CatalogAction = "draft" | "publish";

class CatalogApiError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409 | 500, message: string, public readonly code = "SUPPLIER_CATALOG_REQUEST_FAILED") {
    super(message);
    this.name = "CatalogApiError";
  }
}

interface CatalogClient {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from: (bucket: "wesup-public") => {
      upload: (path: string, file: File, options: { contentType: string; cacheControl: string; upsert: boolean }) => PromiseLike<{ data: { path: string } | null; error: { message?: string; code?: string; statusCode?: number | string } | null }>;
      remove: (paths: string[]) => PromiseLike<{ error: { message?: string; code?: string; statusCode?: number | string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

function asCatalogClient(client: unknown): CatalogClient {
  return client as CatalogClient;
}

async function requireSupplier() {
  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (error) {
    return { client: null, response: toAuthResponse(error) };
  }
  return { client: asCatalogClient(client), response: null };
}

function jsonError(error: unknown): NextResponse {
  if (error instanceof CatalogApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[suppliers/batches] request failed", error);
  return NextResponse.json({ error: "Katalog belum dapat diproses.", code: "SUPPLIER_CATALOG_REQUEST_FAILED" }, { status: 500 });
}

function rpcError(error: unknown): CatalogApiError {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "42501") return new CatalogApiError(403, "Akses supplier ditolak.", "SUPPLIER_CATALOG_FORBIDDEN");
  if (code === "P0002") return new CatalogApiError(404, "Katalog tidak ditemukan.", "SUPPLIER_CATALOG_NOT_FOUND");
  if (code === "22023") return new CatalogApiError(400, "Data katalog tidak valid.", "SUPPLIER_CATALOG_INVALID");
  if (code === "55000") return new CatalogApiError(409, "Perubahan katalog bertentangan dengan status saat ini.", "SUPPLIER_CATALOG_CONFLICT");
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  if (/not found|read-only|locked|participant|publishable|cancellable/i.test(message)) {
    return new CatalogApiError(409, message || "Perubahan katalog bertentangan dengan status saat ini.", "SUPPLIER_CATALOG_CONFLICT");
  }
  if (/approval|supplier/i.test(message) && /required|only|permission/i.test(message)) {
    return new CatalogApiError(403, "Akun supplier belum dapat menerbitkan katalog.", "SUPPLIER_CATALOG_NOT_APPROVED");
  }
  if (/required|invalid|positive|future|linear|tier|location|photo|category/i.test(message)) {
    return new CatalogApiError(400, message || "Data katalog tidak valid.", "SUPPLIER_CATALOG_INVALID");
  }
  return new CatalogApiError(500, "Katalog belum dapat diproses.");
}

function actionFrom(value: FormDataEntryValue | null, fallback: CatalogAction): CatalogAction {
  return value === "draft" || value === "publish" ? value : fallback;
}

async function parseCatalogForm(request: Request, fallbackAction: CatalogAction) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new CatalogApiError(400, "Payload katalog tidak valid.", "SUPPLIER_CATALOG_INVALID");
  }
  if (form.has("supplierId")) throw new CatalogApiError(400, "supplierId tidak boleh dikirim.", "SUPPLIER_CATALOG_INVALID");
  const rawPayload = form.get("payload");
  if (typeof rawPayload !== "string") {
    throw new CatalogApiError(400, "Payload katalog wajib diisi.", "SUPPLIER_CATALOG_INVALID");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawPayload);
  } catch {
    throw new CatalogApiError(400, "Payload katalog bukan JSON yang valid.", "SUPPLIER_CATALOG_INVALID");
  }
  const payload = parseSupplierCatalogPayload(decoded);
  if (!payload) throw new CatalogApiError(400, "Periksa kembali data katalog.", "SUPPLIER_CATALOG_INVALID");
  const action = actionFrom(form.get("action"), fallbackAction);
  const productPhotoEntry = form.get("productPhoto");
  const productPhoto = productPhotoEntry instanceof File && productPhotoEntry.size > 0 ? productPhotoEntry : null;
  if (productPhoto) {
    const photoError = await validateBusinessPhoto(productPhoto);
    if (photoError) throw new CatalogApiError(400, photoError, "SUPPLIER_CATALOG_INVALID");
  }
  return { payload, action, productPhoto };
}

function rpcArgs(payload: SupplierCatalogPayload) {
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
    p_tiers: payload.tiers.map((tier) => ({
      tier_number: tier.tierNumber,
      min_volume: tier.minimumQuantity,
      max_volume: tier.maximumQuantity,
      price_per_unit: tier.pricePerUnit,
    })),
  };
}

function validatePayload(payload: SupplierCatalogPayload, allowPastTimeline = false) {
  const result = validateCatalogMutation({ ...payload, productPhotoUrl: null }, { allowPastTimeline });
  if (!result.ok) {
    throw new CatalogApiError(400, Object.values(result.fieldErrors)[0] ?? "Periksa kembali data katalog.", "SUPPLIER_CATALOG_INVALID");
  }
}

async function getRawBatch(client: CatalogClient, id: string): Promise<SupplierBatchRpcRow | null> {
  const { data, error } = await client.rpc("get_supplier_batch", { p_batch_id: id });
  if (error) throw rpcError(error);
  const rows = Array.isArray(data) ? data : [];
  return (rows[0] as SupplierBatchRpcRow | undefined) ?? null;
}

function responseItem(row: SupplierBatchRpcRow) {
  return mapSupplierBatchRow(row);
}

async function uploadPhoto(client: CatalogClient, batchId: string, photo: File) {
  const path = `products/${batchId}/${randomUUID()}.webp`;
  const { data, error } = await client.storage.from("wesup-public").upload(path, photo, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });
  if (error || !data) {
    console.error("[suppliers/batches] product photo upload failed", {
      batchId,
      path,
      code: error?.code,
      statusCode: error?.statusCode,
      message: error?.message ?? "Storage upload returned no object",
    });
    throw new CatalogApiError(500, "Foto produk belum dapat diunggah.", "SUPPLIER_CATALOG_UPLOAD_FAILED");
  }

  return { path: data.path, url: client.storage.from("wesup-public").getPublicUrl(data.path).data.publicUrl };
}

async function removePhoto(client: CatalogClient, path: string | null) {
  if (!path) return null;
  try { return (await client.storage.from("wesup-public").remove([path])).error; } catch (error) { return error; }
}

export async function POST(request: Request) {
  const auth = await requireSupplier();
  if (auth.response) return auth.response;
  const client = auth.client!;
  let createdId: string | null = null;
  let uploadedPath: string | null = null;
  let published = false;
  try {
    const { payload, action, productPhoto } = await parseCatalogForm(request, "publish");
    validatePayload(payload);
    if (action === "publish" && !productPhoto) {
      throw new CatalogApiError(400, "Foto produk wajib diunggah sebelum menerbitkan.", "SUPPLIER_CATALOG_INVALID");
    }

    const created = await client.rpc("create_supplier_batch", rpcArgs(payload));
    if (created.error) throw rpcError(created.error);
    createdId = typeof created.data === "string" ? created.data : Array.isArray(created.data) ? String(created.data[0]) : null;
    if (!createdId) throw new CatalogApiError(500, "Batch katalog tidak berhasil dibuat.");

    let photoUrl: string | null = null;
    if (productPhoto) {
      const uploaded = await uploadPhoto(client, createdId, productPhoto);
      uploadedPath = uploaded.path;
      photoUrl = uploaded.url;
    }

    if (action === "publish") {
      const publishedResult = await client.rpc("publish_supplier_batch", {
        p_batch_id: createdId,
        p_product_photo_url: photoUrl,
      });
      if (publishedResult.error) throw rpcError(publishedResult.error);
      published = true;
    } else if (photoUrl) {
      const updated = await client.rpc("update_supplier_batch", {
        ...rpcArgs(payload),
        p_batch_id: createdId,
        p_product_photo_url: photoUrl,
      });
      if (updated.error) throw rpcError(updated.error);
    }

    const row = await getRawBatch(client, createdId);
    if (!row) throw new CatalogApiError(500, "Katalog berhasil diproses tetapi detailnya belum tersedia.");
    return NextResponse.json({ item: responseItem(row) }, { status: 201 });
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    if (!published) {
      const storageFailure = await removePhoto(client, uploadedPath);
      if (storageFailure) cleanupFailures.push(storageFailure);
      if (createdId) { try { const result = await client.rpc("delete_supplier_batch", { p_batch_id: createdId }); if (result.error) cleanupFailures.push(result.error); } catch (cleanupError) { cleanupFailures.push(cleanupError); } }
    }
    if (cleanupFailures.length) { console.error("[suppliers/batches] cleanup failed", { batchId: createdId, path: uploadedPath, failures: cleanupFailures }); return NextResponse.json({ error: "Katalog belum dapat diproses.", code: "SUPPLIER_CATALOG_CLEANUP_FAILED" }, { status: 500 }); }
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  const auth = await requireSupplier();
  if (auth.response) return auth.response;
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    const requestedStatus = (url.searchParams.get("status") ?? "").toLowerCase();
    const normalizedStatus = requestedStatus === "cancelled_by_supplier" ? "cancelled" : requestedStatus;
    const status = ["draft", "published", "closed", "cancelled", "takedown", "completed"].includes(normalizedStatus)
      ? normalizedStatus as BatchStatus
      : null;
    const { data, error } = await auth.client!.rpc("list_supplier_batches", { p_status: null, p_query: query || null });
    if (error) throw rpcError(error);
    const rows = (Array.isArray(data) ? data : []) as SupplierBatchRpcRow[];
    const items = rows.map(responseItem);
    const counts = { ALL: items.length, DRAFT: 0, PUBLISHED: 0, CLOSED: 0, CANCELLED_BY_SUPPLIER: 0, TAKEDOWN: 0, COMPLETED: 0 } as Record<string, number>;
    for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
    const filtered = status
      ? items.filter((item) => status === "cancelled" ? item.status === "CANCELLED_BY_SUPPLIER" : item.status.toLowerCase() === status)
      : items;
    return NextResponse.json({ items: filtered, counts });
  } catch (error) {
    return jsonError(error);
  }
}
