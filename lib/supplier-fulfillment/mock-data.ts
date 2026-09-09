import type { FulfillmentOrder } from "./types";

// Deliverable orders are scoped per batch. The mock list mirrors what the
// `list_batch_orders` RPC returns (registration id, umkm name, quantity,
// status, final amount, locked tier, created at) plus pickup-specific data
// (pickup code / PIN used for the serah terima flow).

const BASE_PAID_CODE = "qr-token-nila-0";
const BASE_PAID_CREATED_AT = "2026-08-28T09:15:00.000Z";

export const FULFILLMENT_ORDER_MOCKS: readonly FulfillmentOrder[] = [
  // ── batch-paid-001: Ikan Nila Segar (5 paid, mixed pickup states) ────────
  {
    registrationId: "reg-nila-001",
    batchId: "batch-paid-001",
    displayCode: "ORD-20260828-0001",
    umkmName: "RM Sari Laut",
    quantity: 12,
    unit: "kg",
    status: "picked_up",
    finalAmount: 336_000,
    lockedTier: 3,
    createdAt: BASE_PAID_CREATED_AT,
    pickupCode: `${BASE_PAID_CODE}1`,
    pinCode: "4821",
    pickedUpAt: "2026-09-01T03:10:00.000Z",
    pickedUpByMethod: "qr",
  },
  {
    registrationId: "reg-nila-002",
    batchId: "batch-paid-001",
    displayCode: "ORD-20260828-0002",
    umkmName: "Katering Mbok Darmi",
    quantity: 8,
    unit: "kg",
    status: "picked_up",
    finalAmount: 224_000,
    lockedTier: 3,
    createdAt: BASE_PAID_CREATED_AT,
    pickupCode: `${BASE_PAID_CODE}2`,
    pinCode: "7310",
    pickedUpAt: "2026-09-01T04:45:00.000Z",
    pickedUpByMethod: "pin",
  },
  {
    registrationId: "reg-nila-003",
    batchId: "batch-paid-001",
    displayCode: "ORD-20260828-0003",
    umkmName: "Warung Pojok Bu Een",
    quantity: 10,
    unit: "kg",
    status: "paid",
    finalAmount: 280_000,
    lockedTier: 3,
    createdAt: BASE_PAID_CREATED_AT,
    pickupCode: `${BASE_PAID_CODE}3`,
    pinCode: "9204",
    pickedUpAt: null,
    pickedUpByMethod: null,
  },
  {
    registrationId: "reg-nila-004",
    batchId: "batch-paid-001",
    displayCode: "ORD-20260828-0004",
    umkmName: "RN Ikan Bakar",
    quantity: 20,
    unit: "kg",
    status: "paid",
    finalAmount: 560_000,
    lockedTier: 3,
    createdAt: BASE_PAID_CREATED_AT,
    pickupCode: `${BASE_PAID_CODE}4`,
    pinCode: "3158",
    pickedUpAt: null,
    pickedUpByMethod: null,
  },
  {
    registrationId: "reg-nila-005",
    batchId: "batch-paid-001",
    displayCode: "ORD-20260828-0005",
    umkmName: "Catering Alana",
    quantity: 6,
    unit: "kg",
    status: "pending_payment",
    finalAmount: null,
    lockedTier: null,
    createdAt: BASE_PAID_CREATED_AT,
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
    pickedUpByMethod: null,
  },
  {
    registrationId: "reg-nila-006",
    batchId: "batch-paid-001",
    displayCode: "ORD-20260828-0006",
    umkmName: "Pecel Lele Mang Udin",
    quantity: 8,
    unit: "kg",
    status: "no_show",
    finalAmount: 224_000,
    lockedTier: 3,
    createdAt: BASE_PAID_CREATED_AT,
    pickupCode: `${BASE_PAID_CODE}6`,
    pinCode: "6402",
    pickedUpAt: null,
    pickedUpByMethod: null,
  },

  // ── batch-active-001: Kentang Granola Segar (registered / pending) ───────
  {
    registrationId: "reg-kentang-001",
    batchId: "batch-active-001",
    displayCode: "ORD-20260828-0101",
    umkmName: "Sayur Sehat Ibu Ratna",
    quantity: 15,
    unit: "kg",
    status: "registered",
    finalAmount: null,
    lockedTier: null,
    createdAt: "2026-08-27T08:00:00.000Z",
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
    pickedUpByMethod: null,
  },
  {
    registrationId: "reg-kentang-002",
    batchId: "batch-active-001",
    displayCode: "ORD-20260828-0102",
    umkmName: "Kimochi Kitchen",
    quantity: 9,
    unit: "kg",
    status: "registered",
    finalAmount: null,
    lockedTier: null,
    createdAt: "2026-08-27T09:30:00.000Z",
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
    pickedUpByMethod: null,
  },
];

export const batchIdsWithOrders: readonly string[] = [
  "batch-paid-001",
  "batch-active-001",
];

export function mockOrdersForBatch(batchId: string): FulfillmentOrder[] {
  return FULFILLMENT_ORDER_MOCKS.filter(
    (order) => order.batchId === batchId,
  ).map((order) => ({ ...order }));
}
