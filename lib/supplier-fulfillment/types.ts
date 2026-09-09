export type AsyncPhase = "idle" | "loading" | "success" | "error";

export type FulfillmentOrderStatus =
  | "registered"
  | "pending_payment"
  | "paid"
  | "picked_up"
  | "no_show"
  | "cancelled";

export type PickupMethod = "qr" | "pin";

export interface FulfillmentOrder {
  registrationId: string;
  batchId: string;
  displayCode: string;
  umkmName: string;
  quantity: number;
  unit: string;
  status: FulfillmentOrderStatus;
  finalAmount: number | null;
  lockedTier: number | null;
  createdAt: string;
  pickupCode: string | null;
  pinCode: string | null;
  pickedUpAt: string | null;
  pickedUpByMethod: PickupMethod | null;
}

export interface FulfillmentOrderList {
  batchId: string;
  orders: readonly FulfillmentOrder[];
}

export interface ConfirmPickupInput {
  method: PickupMethod;
  code: string;
}

export interface ConfirmPickupResult {
  order: FulfillmentOrder;
}

export interface ForceMajeureResult {
  batchId: string;
  cancelledAt: string;
  refundedOrderCount: number;
}

export interface FulfillmentError {
  code:
    | "invalid_code"
    | "already_picked_up"
    | "not_eligible"
    | "order_not_found"
    | "force_majeure_failed";
  message: string;
}

export interface FulfillmentRepository {
  listOrders(
    batchId: string,
    options?: { signal?: AbortSignal },
  ): Promise<FulfillmentOrderList>;
  confirmPickup(
    registrationId: string,
    input: ConfirmPickupInput,
    options?: { signal?: AbortSignal },
  ): Promise<ConfirmPickupResult>;
  forceMajeureCancel(
    batchId: string,
    options?: { signal?: AbortSignal },
  ): Promise<ForceMajeureResult>;
}
