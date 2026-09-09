export type AsyncPhase = "idle" | "loading" | "success" | "error";

export type EscrowHoldStatus = "held" | "released" | "refunded" | "forfeited";

export interface SupplierBankAccount {
  id: string;
  supplierId: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface SupplierBankAccountInput {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  isPrimary?: boolean;
}

export interface EscrowHold {
  id: string;
  registrationId: string;
  batchId: string;
  batchTitle: string;
  batchDisplayCode: string;
  umkmName: string;
  amount: number;
  status: EscrowHoldStatus;
  pickupConfirmedAt: string;
  autoReleaseAt: string;
  releasedAt: string | null;
  releaseDestination: "supplier" | "umkm" | null;
  disputeId: string | null;
  createdAt: string;
}

export interface DisbursementSummary {
  totalHeld: number;
  totalReleased: number;
  totalForfeited: number;
  heldCount: number;
  releasedCount: number;
  forfeitedCount: number;
}

export interface SupplierDisbursementRepository {
  listBankAccounts(
    supplierId: string,
    options?: { signal?: AbortSignal },
  ): Promise<readonly SupplierBankAccount[]>;
  addBankAccount(
    supplierId: string,
    input: SupplierBankAccountInput,
    options?: { signal?: AbortSignal },
  ): Promise<SupplierBankAccount>;
  removeBankAccount(
    accountId: string,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  listEscrowHolds(
    supplierId: string,
    options?: { signal?: AbortSignal },
  ): Promise<readonly EscrowHold[]>;
  getSummary(
    supplierId: string,
    options?: { signal?: AbortSignal },
  ): Promise<DisbursementSummary>;
}
