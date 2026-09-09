import type {
  AsyncPhase,
  FulfillmentError,
  FulfillmentOrder,
  ForceMajeureResult,
  PickupMethod,
} from "./types";

export type PickupPhase = AsyncPhase | "success";

export interface PickupViewState {
  loadPhase: AsyncPhase;
  orders: FulfillmentOrder[];
  loadError: string | null;
  selectedRegistrationId: string | null;
  method: PickupMethod;
  code: string;
  confirmPhase: PickupPhase;
  confirmError: FulfillmentError | null;
  resultOrder: FulfillmentOrder | null;
  forceMajeureOpen: boolean;
  forceMajeurePhase: AsyncPhase;
  forceMajeureError: string | null;
  forceMajeureResult: ForceMajeureResult | null;
}

export type PickupAction =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; orders: FulfillmentOrder[] }
  | { type: "loadFailed"; message: string }
  | { type: "selectOrder"; registrationId: string | null }
  | { type: "methodChanged"; method: PickupMethod }
  | { type: "codeChanged"; code: string }
  | { type: "confirmStarted" }
  | { type: "confirmSucceeded"; order: FulfillmentOrder }
  | { type: "confirmFailed"; error: FulfillmentError }
  | { type: "resetResult" }
  | { type: "forceMajeureOpened" }
  | { type: "forceMajeureClosed" }
  | { type: "forceMajeureStarted" }
  | { type: "forceMajeureSucceeded"; result: ForceMajeureResult }
  | { type: "forceMajeureFailed"; message: string };

export const initialPickupViewState: PickupViewState = {
  loadPhase: "idle",
  orders: [],
  loadError: null,
  selectedRegistrationId: null,
  method: "qr",
  code: "",
  confirmPhase: "idle",
  confirmError: null,
  resultOrder: null,
  forceMajeureOpen: false,
  forceMajeurePhase: "idle",
  forceMajeureError: null,
  forceMajeureResult: null,
};

export function pickupViewReducer(
  state: PickupViewState,
  action: PickupAction,
): PickupViewState {
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
    case "selectOrder":
      return {
        ...state,
        selectedRegistrationId: action.registrationId,
        code: "",
        confirmPhase: "idle",
        confirmError: null,
        resultOrder: null,
      };
    case "methodChanged":
      return {
        ...state,
        method: action.method,
        code: "",
        confirmPhase: "idle",
        confirmError: null,
        resultOrder: null,
      };
    case "codeChanged":
      return { ...state, code: action.code };
    case "confirmStarted":
      return {
        ...state,
        confirmPhase: "loading",
        confirmError: null,
      };
    case "confirmSucceeded":
      return {
        ...state,
        confirmPhase: "success",
        resultOrder: action.order,
        confirmError: null,
        code: "",
        orders: state.orders.map((order) =>
          order.registrationId === action.order.registrationId
            ? action.order
            : order,
        ),
      };
    case "confirmFailed":
      return {
        ...state,
        confirmPhase: "error",
        confirmError: action.error,
      };
    case "resetResult":
      return {
        ...state,
        confirmPhase: "idle",
        confirmError: null,
        resultOrder: null,
        code: "",
      };
    case "forceMajeureOpened":
      return { ...state, forceMajeureOpen: true, forceMajeureError: null };
    case "forceMajeureClosed":
      return state.forceMajeurePhase === "loading"
        ? state
        : { ...state, forceMajeureOpen: false };
    case "forceMajeureStarted":
      return { ...state, forceMajeurePhase: "loading", forceMajeureError: null };
    case "forceMajeureSucceeded":
      return {
        ...state,
        forceMajeurePhase: "success",
        forceMajeureResult: action.result,
        forceMajeureOpen: false,
        forceMajeureError: null,
        orders: state.orders.map((order) =>
          order.batchId === action.result.batchId
            ? { ...order, status: "cancelled", pickupCode: null, pinCode: null }
            : order,
        ),
      };
    case "forceMajeureFailed":
      return {
        ...state,
        forceMajeurePhase: "error",
        forceMajeureError: action.message,
      };
  }
}
