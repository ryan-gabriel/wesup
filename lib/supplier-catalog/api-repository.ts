import type { SupplierBatchDetail, SupplierBatchRepository } from "@/lib/supplier-batch/types";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";
import { draftToPayload, mapSupplierBatchRow, type SupplierCatalogListResponse, type SupplierBatchRpcRow } from "@/lib/supplier-catalog/api";

export type CatalogMutationAction = "draft" | "publish";

export interface SupplierCatalogRepository {
  list(options?: { query?: string; status?: string; signal?: AbortSignal }): Promise<SupplierCatalogListResponse>;
  getById(id: string, options?: { signal?: AbortSignal }): Promise<SupplierBatchDetail | null>;
  create(draft: CatalogDraft, action: CatalogMutationAction, options?: { signal?: AbortSignal }): Promise<SupplierBatchDetail>;
  update(id: string, draft: CatalogDraft, action?: CatalogMutationAction, options?: { signal?: AbortSignal }): Promise<SupplierBatchDetail>;
  cancel(id: string, reason: string, options?: { signal?: AbortSignal }): Promise<void>;
  delete(id: string, options?: { signal?: AbortSignal }): Promise<void>;
}

export async function readSupplierCatalogError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim() !== "") return body.error;
  } catch {
    // Use the HTTP status below when the server did not return JSON.
  }
  return response.statusText || `Request gagal (${response.status})`;
}

async function readItem(response: Response): Promise<SupplierBatchDetail> {
  if (!response.ok) throw new Error(await readSupplierCatalogError(response));
  const body = await response.json() as { item?: SupplierBatchRpcRow | SupplierBatchDetail };
  if (!body.item) throw new Error("Respons katalog tidak lengkap.");
  const item = body.item;
  if ("timeline" in item && "pickup" in item) return item as SupplierBatchDetail;
  return mapSupplierBatchRow(item as SupplierBatchRpcRow);
}

function toFormData(draft: CatalogDraft, action: CatalogMutationAction): FormData {
  const form = new FormData();
  form.set("action", action);
  form.set("payload", JSON.stringify(draftToPayload(draft)));
  if (draft.productPhoto) form.set("productPhoto", draft.productPhoto);
  return form;
}

export const supplierCatalogApiRepository: SupplierCatalogRepository = {
  async list({ query = "", status, signal }: { query?: string; status?: string; signal?: AbortSignal } = {}) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status && status !== "ALL") params.set("status", status.toLowerCase());
    const response = await fetch(`/api/suppliers/batches${params.size ? `?${params}` : ""}`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error(await readSupplierCatalogError(response));
    return await response.json() as SupplierCatalogListResponse;
  },

  async getById(id, { signal } = {}) {
    const response = await fetch(`/api/suppliers/batches/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
    if (response.status === 404) return null;
    return readItem(response);
  },

  async create(draft, action, { signal } = {}) {
    return readItem(await fetch("/api/suppliers/batches", { method: "POST", body: toFormData(draft, action), signal }));
  },

  async update(id, draft, action = "draft", { signal } = {}) {
    return readItem(await fetch(`/api/suppliers/batches/${encodeURIComponent(id)}`, { method: "PATCH", body: toFormData(draft, action), signal }));
  },

  async cancel(id, reason, { signal } = {}) {
    const response = await fetch(`/api/suppliers/batches/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
      headers: { "content-type": "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(await readSupplierCatalogError(response));
  },

  async delete(id, { signal } = {}) {
    const response = await fetch(`/api/suppliers/batches/${encodeURIComponent(id)}`, { method: "DELETE", signal });
    if (!response.ok) throw new Error(await readSupplierCatalogError(response));
  },
};

export const supplierBatchApiRepository: SupplierBatchRepository = {
  async getById(id, options) {
    return supplierCatalogApiRepository.getById(id, options);
  },
  async cancel(id, input, options) {
    await supplierCatalogApiRepository.cancel(id, input.reason, options);
    const batch = await supplierCatalogApiRepository.getById(id, options);
    if (!batch) throw new Error("Katalog tidak ditemukan setelah dibatalkan.");
    return batch;
  },
};
