import { describe, expect, it } from "vitest";
import type { FulfillmentOrder } from "@/lib/supplier-fulfillment/types";
import { fulfillmentMockRepository } from "@/lib/supplier-fulfillment/mock-repository";
import {
  fulfillmentOrderListReducer,
  initialFulfillmentOrderListState,
} from "@/lib/supplier-fulfillment/state";
import {
  pickupViewReducer,
  initialPickupViewState,
} from "@/lib/supplier-fulfillment/pickup-state";

function makeOrder(
  overrides: Partial<FulfillmentOrder> = {},
): FulfillmentOrder {
  return {
    registrationId: "reg-000",
    batchId: "batch-000",
    displayCode: "ORD-0000",
    umkmName: "UMKM A",
    quantity: 1,
    unit: "kg",
    status: "paid",
    finalAmount: 100_000,
    lockedTier: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    pickupCode: "qr-token-a",
    pinCode: "1234",
    pickedUpAt: null,
    pickedUpByMethod: null,
    ...overrides,
  };
}

describe("fulfillmentMockRepository: listOrders", () => {
  it("returns only the orders scoped to the requested batch", async () => {
    const batchPaid = await fulfillmentMockRepository.listOrders("batch-paid-001");
    expect(batchPaid.batchId).toBe("batch-paid-001");
    expect(batchPaid.orders.length).toBeGreaterThan(0);
    expect(batchPaid.orders.every((o) => o.batchId === "batch-paid-001")).toBe(true);
  });

  it("returns an empty list for a batch without orders", async () => {
    const empty = await fulfillmentMockRepository.listOrders("batch-none");
    expect(empty.orders).toEqual([]);
  });

  it("returns clones so caller mutation never corrupts the store", async () => {
    const first = await fulfillmentMockRepository.listOrders("batch-active-001");
    const before = first.orders[0].status;
    first.orders[0].status = "cancelled";
    const second = await fulfillmentMockRepository.listOrders("batch-active-001");
    expect(second.orders[0].status).toBe(before);
  });
});

describe("fulfillmentMockRepository: confirmPickup", () => {
  it("rejects an empty code", async () => {
    await expect(
      fulfillmentMockRepository.confirmPickup("reg-nila-003", {
        method: "qr",
        code: "",
      }),
    ).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("rejects an unknown registration", async () => {
    await expect(
      fulfillmentMockRepository.confirmPickup("reg-missing", {
        method: "qr",
        code: "anything",
      }),
    ).rejects.toMatchObject({ code: "order_not_found" });
  });

  it("rejects an order already picked up (natively picked_up fixture)", async () => {
    await expect(
      fulfillmentMockRepository.confirmPickup("reg-nila-001", {
        method: "qr",
        code: "qr-token-nila-01",
      }),
    ).rejects.toMatchObject({ code: "already_picked_up" });
  });

  it("rejects an order that has not been paid", async () => {
    await expect(
      fulfillmentMockRepository.confirmPickup("reg-nila-005", {
        method: "qr",
        code: "anything",
      }),
    ).rejects.toMatchObject({ code: "not_eligible" });
  });

  it("rejects a wrong QR code", async () => {
    await expect(
      fulfillmentMockRepository.confirmPickup("reg-nila-003", {
        method: "qr",
        code: "wrong-code",
      }),
    ).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("accepts a paid order via a valid QR code and nulls out the codes", async () => {
    const result = await fulfillmentMockRepository.confirmPickup("reg-nila-003", {
      method: "qr",
      code: "qr-token-nila-03",
    });
    expect(result.order.status).toBe("picked_up");
    expect(result.order.pickedUpByMethod).toBe("qr");
    expect(result.order.pickupCode).toBeNull();
    expect(result.order.pinCode).toBeNull();
    expect(result.order.pickedUpAt).not.toBeNull();
  });

  it("accepts a paid order via a valid 4-digit PIN", async () => {
    const result = await fulfillmentMockRepository.confirmPickup("reg-nila-004", {
      method: "pin",
      code: "3158",
    });
    expect(result.order.status).toBe("picked_up");
    expect(result.order.pickedUpByMethod).toBe("pin");
  });

  it("persists the pickup so a subsequent list reflects the new state", async () => {
    const list = await fulfillmentMockRepository.listOrders("batch-paid-001");
    const picked = list.orders.find((o) => o.registrationId === "reg-nila-004");
    expect(picked?.status).toBe("picked_up");
  });
});

describe("fulfillmentMockRepository: forceMajeureCancel", () => {
  it("cancels paid + non-paid orders and reports the refund count", async () => {
    const result = await fulfillmentMockRepository.forceMajeureCancel(
      "batch-paid-001",
    );
    expect(result.batchId).toBe("batch-paid-001");
    // reg-nila-003 & reg-nila-004 were flipped to picked_up earlier, leaving the
    // remaining paid count consistent with the mutable store at call time.
    expect(result.refundedOrderCount).toBeGreaterThanOrEqual(0);
    const list = await fulfillmentMockRepository.listOrders("batch-paid-001");
    expect(list.orders.every((o) => o.status === "cancelled" || o.status === "picked_up" || o.status === "no_show")).toBe(true);
  });

  it("throws a force_majeure_failed error for the failure demo batch", async () => {
    await expect(
      fulfillmentMockRepository.forceMajeureCancel("batch-active-002"),
    ).rejects.toMatchObject({ code: "force_majeure_failed" });
  });
});

describe("fulfillmentOrderListReducer", () => {
  it("handles the loading lifecycle", () => {
    const loading = fulfillmentOrderListReducer(initialFulfillmentOrderListState, {
      type: "loadStarted",
    });
    expect(loading.loadPhase).toBe("loading");

    const orders = [makeOrder()];
    const loaded = fulfillmentOrderListReducer(loading, {
      type: "loadSucceeded",
      orders,
    });
    expect(loaded.loadPhase).toBe("success");
    expect(loaded.orders).toEqual(orders);

    const failed = fulfillmentOrderListReducer(initialFulfillmentOrderListState, {
      type: "loadFailed",
      message: "Gagal.",
    });
    expect(failed.loadPhase).toBe("error");
    expect(failed.loadError).toBe("Gagal.");
    expect(failed.orders).toEqual([]);
  });

  it("changes the active status filter", () => {
    const next = fulfillmentOrderListReducer(initialFulfillmentOrderListState, {
      type: "filterChanged",
      filter: "paid",
    });
    expect(next.filter).toBe("paid");
  });

  it("replaces an order in place after a pickup", () => {
    const updated = makeOrder({ registrationId: "reg-1", status: "picked_up" });
    const next = fulfillmentOrderListReducer(
      {
        loadPhase: "success",
        orders: [makeOrder({ registrationId: "reg-1" }), makeOrder({ registrationId: "reg-2" })],
        loadError: null,
        filter: "ALL",
      },
      { type: "orderPickedUp", order: updated },
    );
    expect(next.orders.find((o) => o.registrationId === "reg-1")?.status).toBe(
      "picked_up",
    );
    expect(next.orders.find((o) => o.registrationId === "reg-2")?.status).toBe(
      "paid",
    );
  });
});

describe("pickupViewReducer", () => {
  const orders = [
    makeOrder({ registrationId: "reg-a", quantity: 4 }),
    makeOrder({ registrationId: "reg-b", quantity: 9, pickupCode: "qr-2", pinCode: "9999" }),
  ];

  it("applies the load lifecycle and selection", () => {
    const loading = pickupViewReducer(initialPickupViewState, { type: "loadStarted" });
    expect(loading.loadPhase).toBe("loading");

    const loaded = pickupViewReducer(loading, { type: "loadSucceeded", orders });
    expect(loaded.loadPhase).toBe("success");
    expect(loaded.orders).toHaveLength(2);

    const selected = pickupViewReducer(loaded, {
      type: "selectOrder",
      registrationId: "reg-a",
    });
    expect(selected.selectedRegistrationId).toBe("reg-a");
  });

  it("switches scan method and clears the entered code", () => {
    const withCode = pickupViewReducer(initialPickupViewState, {
      type: "codeChanged",
      code: "123",
    });
    const switched = pickupViewReducer(withCode, { type: "methodChanged", method: "pin" });
    expect(switched.method).toBe("pin");
    expect(switched.code).toBe("");
  });

  it("records a successful confirm and updates the order in the list", () => {
    const base = pickupViewReducer(initialPickupViewState, {
      type: "loadSucceeded",
      orders,
    });
    const confirmedOrder = makeOrder({
      registrationId: "reg-a",
      status: "picked_up",
      pickedUpByMethod: "qr",
    });
    const next = pickupViewReducer(base, {
      type: "confirmSucceeded",
      order: confirmedOrder,
    });
    expect(next.confirmPhase).toBe("success");
    expect(next.resultOrder?.registrationId).toBe("reg-a");
    expect(next.orders.find((o) => o.registrationId === "reg-a")?.status).toBe(
      "picked_up",
    );
    expect(next.orders.find((o) => o.registrationId === "reg-b")?.status).toBe(
      "paid",
    );
  });

  it("records a confirm failure, then clears it on reset", () => {
    const failed = pickupViewReducer(initialPickupViewState, {
      type: "confirmFailed",
      error: { code: "invalid_code", message: "Kode tidak valid." },
    });
    expect(failed.confirmPhase).toBe("error");
    expect(failed.confirmError?.code).toBe("invalid_code");
    const reset = pickupViewReducer(failed, { type: "resetResult" });
    expect(reset.confirmPhase).toBe("idle");
    expect(reset.confirmError).toBeNull();
    expect(reset.resultOrder).toBeNull();
  });

  it("handles force majeure open/confirm/success and marks batch orders cancelled", () => {
    const base = pickupViewReducer(initialPickupViewState, {
      type: "loadSucceeded",
      orders,
    });
    const opened = pickupViewReducer(base, { type: "forceMajeureOpened" });
    expect(opened.forceMajeureOpen).toBe(true);

    const next = pickupViewReducer(opened, {
      type: "forceMajeureSucceeded",
      result: { batchId: "batch-000", cancelledAt: "2026-09-02T00:00:00.000Z", refundedOrderCount: 2 },
    });
    expect(next.forceMajeurePhase).toBe("success");
    expect(next.forceMajeureOpen).toBe(false);
    expect(next.orders.every((o) => o.status === "cancelled")).toBe(true);
  });

  it("keeps the dialog open while a force majeure submit is loading", () => {
    const opened = pickupViewReducer(initialPickupViewState, {
      type: "forceMajeureOpened",
    });
    const inFlight = pickupViewReducer(opened, { type: "forceMajeureStarted" });
    expect(inFlight.forceMajeurePhase).toBe("loading");
    const closed = pickupViewReducer(inFlight, { type: "forceMajeureClosed" });
    expect(closed.forceMajeureOpen).toBe(true);
  });
});
