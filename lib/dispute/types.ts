export type DisputeStatus =
  | "pending"
  | "under_review"
  | "resolved_supplier"
  | "resolved_umkm";

export type ComplaintCategory = "cacat" | "busuk";

export type EscrowStatusForUmkm =
  | "frozen"
  | "released"
  | "refunded";

export type EscrowCountdownState = "running" | "expired";

export type RefundStatus =
  | "pending"
  | "waiting_bank_account"
  | "processing"
  | "completed"
  | "failed";

export type RefundTrigger = "dispute_won" | "takedown" | "force_majeure";

export interface DisputeEvidencePhoto {
  url: string;
  caption?: string;
}

export interface DisputeRecord {
  id: string;
  orderId: string;
  complaintCategory: ComplaintCategory;
  description: string;
  photos: DisputeEvidencePhoto[];
  status: DisputeStatus;
  createdAt: string;
  decidedAt: string | null;
  adminNotes: string | null;
  escrowStatus: EscrowStatusForUmkm;
  escrowSuspendedAt: string | null;
}

export interface BankAccountSubmission {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface RefundTicket {
  id: string;
  orderId: string;
  status: RefundStatus;
  trigger: RefundTrigger;
  amount: number;
  bankAccount: BankAccountSubmission | null;
  createdAt: string;
  updatedAt: string | null;
}

export type ComplaintScenario =
  | {
      kind: "window_open";
      pickedUpAt: string;
      deadlineAt: string;
    }
  | {
      kind: "window_closed";
      pickedUpAt: string;
      deadlineAt: string;
    }
  | {
      kind: "filed";
      dispute: DisputeRecord;
      refund: RefundTicket | null;
    };

export const COMPLAINT_WINDOW_HOURS = 24;