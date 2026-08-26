import { SUPPLIER_BATCH_MOCKS } from "./mock-data";
import type {
  SupplierBatchDetail,
  SupplierBatchRepository,
} from "./types";

const GET_BY_ID_LATENCY_MS = 250;
const CANCEL_LATENCY_MS = 500;
const CANCELLED_AT = "2026-08-25T08:00:00.000Z";
const CANCELLATION_FAILURE_MESSAGE = "Pembatalan mock gagal.";

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function afterLatency<T>(
  latencyMs: number,
  signal: AbortSignal | undefined,
  operation: () => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let settled = false;
    const onAbort = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(abortError());
      }
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      try {
        resolve(operation());
      } catch (error) {
        reject(error);
      }
    }, latencyMs);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function cloneBatch(batch: SupplierBatchDetail): SupplierBatchDetail {
  return {
    ...batch,
    tiers: batch.tiers.map((tier) => ({ ...tier })),
    timeline: { ...batch.timeline },
    pickup: { ...batch.pickup },
    cancellation: batch.cancellation ? { ...batch.cancellation } : null,
  };
}

function findBatch(id: string): SupplierBatchDetail | null {
  return SUPPLIER_BATCH_MOCKS.find((batch) => batch.id === id) ?? null;
}

export const supplierBatchMockRepository: SupplierBatchRepository = {
  getById(id, { signal } = {}) {
    return afterLatency(GET_BY_ID_LATENCY_MS, signal, () => {
      const batch = findBatch(id);
      return batch ? cloneBatch(batch) : null;
    });
  },

  cancel(id, { reason }, { signal } = {}) {
    const trimmedReason = reason.trim();
    if (signal?.aborted) {
      return Promise.reject(abortError());
    }
    if (trimmedReason === "") {
      return Promise.reject(new Error("Alasan pembatalan wajib diisi."));
    }

    return afterLatency(CANCEL_LATENCY_MS, signal, () => {
      if (id === "batch-cancel-error") {
        throw new Error(CANCELLATION_FAILURE_MESSAGE);
      }

      const batch = findBatch(id);
      if (!batch) {
        throw new Error("Batch mock tidak ditemukan.");
      }

      return {
        ...cloneBatch(batch),
        status: "CANCELLED_BY_SUPPLIER",
        cancellation: {
          reason: trimmedReason,
          actor: "SUPPLIER",
          cancelledAt: CANCELLED_AT,
        },
      };
    });
  },
};
