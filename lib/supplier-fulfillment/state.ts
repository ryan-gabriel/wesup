import type { AsyncPhase, FulfillmentOrder, FulfillmentOrderStatus } from "./types";

export type OrderStatusFilter = "ALL" | FulfillmentOrderStatus;

export interface FulfillmentOrderListState {
  loadPhase: AsyncPhase;
  orders: FulfillmentOrder[];
  loadError: string | null;
  filter: OrderStatusFilter;
}

export type FulfillmentOrderListAction =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; orders: FulfillmentOrder[] }
  | { type: "loadFailed"; message: string }
  | { type: "filterChanged"; filter: OrderStatusFilter }
  | { type: "orderPickedUp"; order: FulfillmentOrder };

export const initialFulfillmentOrderListState: FulfillmentOrderListState = {
  loadPhase: "idle",
  orders: [],
  loadError: null,
  filter: "ALL",
};

export function fulfillmentOrderListReducer(
  state: FulfillmentOrderListState,
  action: FulfillmentOrderListAction,
): FulfillmentOrderListState {
  switch (action.type) {
    case "loadStarted":
      return {
        ...state,
        loadPhase: "loading",
        orders: [],
        loadError: null,
      };
    case "loadSucceeded":
      return {
        ...state,
        loadPhase: "success",
        orders: action.orders,
        loadError: null,
      };
    case "loadFailed":
      return {
        ...state,
        loadPhase: "error",
        orders: [],
        loadError: action.message,
      };
    case "filterChanged":
      return { ...state, filter: action.filter };
    case "orderPickedUp":
      return {
        ...state,
        orders: state.orders.map((order) =>
          order.registrationId === action.order.registrationId
            ? action.order
            : order,
        ),
      };
  }
}
