export type AsyncPhase = "idle" | "loading" | "success" | "error";

export type ReportStatus = "pending" | "under_review" | "resolved_supplier" | "resolved_umkm";

export interface ReportEntry {
  id: string;
  registrationId: string;
  batchId: string;
  batchTitle: string;
  batchDisplayCode: string;
  umkmId: string;
  umkmName: string;
  description: string;
  photoUrls: string[];
  status: ReportStatus;
  adminNotes: string | null;
  decidedAt: string | null;
  escrowStatus: "held" | "released" | "refunded" | "forfeited";
  createdAt: string;
}

export interface ReportFormInput {
  batchId: string;
  umkmId: string;
  description: string;
  photos: File[];
}

export interface SupplierReportRepository {
  listReports(
    supplierId: string,
    options?: { signal?: AbortSignal },
  ): Promise<readonly ReportEntry[]>;
  submitReport(
    supplierId: string,
    input: ReportFormInput,
    options?: { signal?: AbortSignal },
  ): Promise<ReportEntry>;
}
