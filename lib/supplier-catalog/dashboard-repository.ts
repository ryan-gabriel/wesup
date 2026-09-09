import type { SupplierBatchDetail } from "@/lib/supplier-batch/types";
import { readSupplierCatalogError } from "@/lib/supplier-catalog/api-repository";

export interface SupplierDashboardResponse {
  supplier: {
    displayName: string;
    verificationStatus: string;
  };
  summary: {
    activeBatchCount: number;
    participantCount: number;
    collectedRevenue: number;
    readyToDisburse: number;
    ratingAverage: number | null;
    ratingTotal: number;
  };
  recentBatches: SupplierBatchDetail[];
}

export const supplierDashboardRepository = {
  async get(options: { signal?: AbortSignal } = {}): Promise<SupplierDashboardResponse> {
    const response = await fetch("/api/suppliers/dashboard", {
      signal: options.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readSupplierCatalogError(response));
    return response.json() as Promise<SupplierDashboardResponse>;
  },
};
