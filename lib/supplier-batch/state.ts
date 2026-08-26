import type {
  AsyncPhase,
  SupplierBatchDetail,
} from "./types";

export interface CancellationWarnings {
  notifyParticipants: boolean;
  queueRefunds: boolean;
  participantCount: number;
  paidParticipantCount: number;
}

export interface SupplierBatchViewState {
  loadPhase: AsyncPhase;
  batch: SupplierBatchDetail | null;
  notFound: boolean;
  loadError: string | null;
  dialogOpen: boolean;
  cancellationReason: string;
  cancelPhase: AsyncPhase;
  cancelError: string | null;
}

export type SupplierBatchAction =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; batch: SupplierBatchDetail }
  | { type: "loadNotFound" }
  | { type: "loadFailed"; message: string }
  | { type: "deleteOpened" }
  | { type: "deleteClosed" }
  | { type: "reasonChanged"; value: string }
  | { type: "cancelStarted" }
  | { type: "cancelSucceeded"; batch: SupplierBatchDetail }
  | { type: "cancelFailed"; message: string };

export const initialSupplierBatchState: SupplierBatchViewState = {
  loadPhase: "idle",
  batch: null,
  notFound: false,
  loadError: null,
  dialogOpen: false,
  cancellationReason: "",
  cancelPhase: "idle",
  cancelError: null,
};

export function supplierBatchReducer(
  state: SupplierBatchViewState,
  action: SupplierBatchAction,
): SupplierBatchViewState {
  switch (action.type) {
    case "loadStarted":
      return {
        ...state,
        loadPhase: "loading",
        batch: null,
        notFound: false,
        loadError: null,
        dialogOpen: false,
        cancellationReason: "",
        cancelPhase: "idle",
        cancelError: null,
      };
    case "loadSucceeded":
      return {
        ...state,
        loadPhase: "success",
        batch: action.batch,
        notFound: false,
        loadError: null,
      };
    case "loadNotFound":
      return {
        ...state,
        loadPhase: "success",
        batch: null,
        notFound: true,
        loadError: null,
      };
    case "loadFailed":
      return {
        ...state,
        loadPhase: "error",
        batch: null,
        notFound: false,
        loadError: action.message,
      };
    case "deleteOpened":
      return { ...state, dialogOpen: true, cancelError: null };
    case "deleteClosed":
      return state.cancelPhase === "loading" ? state : { ...state, dialogOpen: false };
    case "reasonChanged":
      return { ...state, cancellationReason: action.value };
    case "cancelStarted":
      return { ...state, cancelPhase: "loading", cancelError: null };
    case "cancelSucceeded":
      return {
        ...state,
        batch: action.batch,
        dialogOpen: false,
        cancellationReason: "",
        cancelPhase: "success",
        cancelError: null,
      };
    case "cancelFailed":
      return {
        ...state,
        dialogOpen: true,
        cancelPhase: "error",
        cancelError: action.message,
      };
  }
}

export function getCancellationWarnings(batch: SupplierBatchDetail): CancellationWarnings {
  return {
    notifyParticipants: batch.participantCount > 0,
    queueRefunds: batch.paidParticipantCount > 0,
    participantCount: batch.participantCount,
    paidParticipantCount: batch.paidParticipantCount,
  };
}

export function canCancelBatch(batch: SupplierBatchDetail): boolean {
  return batch.status === "PUBLISHED";
}
