import { FULFILLMENT_ORDER_MOCKS } from "./mock-data";
import type {
  ConfirmPickupResult,
  FulfillmentError,
  FulfillmentOrder,
  FulfillmentOrderList,
  FulfillmentRepository,
  ForceMajeureResult,
} from "./types";

const LIST_LATENCY_MS = 250;
const CONFIRM_LATENCY_MS = 400;
const FORCE_MAJEURE_LATENCY_MS = 500;

// Batch id that simulates a Force Majeure failure (to exercise the error UI).
const FORCE_MAJEURE_FAIL_BATCH = "batch-active-002";

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function fulfillmentError(code: FulfillmentError["code"], message: string): FulfillmentError {
  return { code, message };
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

// In-memory mutable store so a successful pickup is reflected by subsequent
// list calls during a single visit. Mirrors the static/mock base-UI intent.
const mutableOrders: FulfillmentOrder[] = FULFILLMENT_ORDER_MOCKS.map(
  (order) => ({ ...order }),
);

const cloneOrder = (order: FulfillmentOrder): FulfillmentOrder => ({
  ...order,
});

const isEligibleForPickup = (status: FulfillmentOrder["status"]) =>
  status === "paid";

export const fulfillmentMockRepository: FulfillmentRepository = {
  listOrders(batchId, { signal } = {}) {
    return afterLatency(LIST_LATENCY_MS, signal, () => {
      const orders = mutableOrders.filter(
        (order) => order.batchId === batchId,
      );
      const list: FulfillmentOrderList = {
        batchId,
        orders: orders.map(cloneOrder),
      };
      return list;
    });
  },

  confirmPickup(registrationId, input, { signal } = {}) {
    const code = input.code.trim();
    if (!code) {
      return Promise.reject(
        fulfillmentError("invalid_code", "Kode wajib diisi."),
      );
    }

    return afterLatency(CONFIRM_LATENCY_MS, signal, () => {
      const order = mutableOrders.find(
        (item) => item.registrationId === registrationId,
      );
      if (!order) {
        throw fulfillmentError("order_not_found", "Pesanan tidak ditemukan.");
      }

      if (order.status === "picked_up") {
        throw fulfillmentError(
          "already_picked_up",
          "Pesanan ini sudah diambil sebelumnya.",
        );
      }

      if (!isEligibleForPickup(order.status)) {
        throw fulfillmentError(
          "not_eligible",
          "Pesanan belum lunas atau tidak memenuhi syarat serah terima.",
        );
      }

      const expectedCode =
        input.method === "qr" ? order.pickupCode : order.pinCode;

      if (!expectedCode || expectedCode.toLowerCase() !== code.toLowerCase()) {
        throw fulfillmentError(
          "invalid_code",
          "Kode tidak valid atau sudah digunakan.",
        );
      }

      order.status = "picked_up";
      order.pickedUpAt = new Date().toISOString();
      order.pickedUpByMethod = input.method;
      order.pickupCode = null;
      order.pinCode = null;

      const result: ConfirmPickupResult = { order: cloneOrder(order) };
      return result;
    });
  },

  forceMajeureCancel(batchId, { signal } = {}) {
    return afterLatency(FORCE_MAJEURE_LATENCY_MS, signal, () => {
      if (batchId === FORCE_MAJEURE_FAIL_BATCH) {
        throw fulfillmentError(
          "force_majeure_failed",
          "Pembatalan darurat gagal diproses. Silakan coba lagi.",
        );
      }

      const batchOrders = mutableOrders.filter(
        (order) => order.batchId === batchId,
      );
      let refundedOrderCount = 0;

      for (const order of batchOrders) {
        if (order.status === "paid") refundedOrderCount += 1;
        if (order.status === "paid" || order.status === "registered" || order.status === "pending_payment") {
          order.status = "cancelled";
          order.pickupCode = null;
          order.pinCode = null;
        }
      }

      const result: ForceMajeureResult = {
        batchId,
        cancelledAt: new Date().toISOString(),
        refundedOrderCount,
      };
      return result;
    });
  },
};
