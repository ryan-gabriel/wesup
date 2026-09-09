import type { RecurringConfig } from "./types";
import type { AsyncPhase } from "@/lib/supplier-batch/types";

export interface RecurringListState {
  loadPhase: AsyncPhase;
  configs: RecurringConfig[];
  loadError: string | null;
  togglePhase: AsyncPhase;
  toggleError: string | null;
}

export type RecurringListAction =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; configs: RecurringConfig[] }
  | { type: "loadFailed"; message: string }
  | { type: "toggleStarted"; configId: string }
  | { type: "toggleSucceeded"; config: RecurringConfig }
  | { type: "toggleFailed"; message: string };

export const initialRecurringListState: RecurringListState = {
  loadPhase: "idle",
  configs: [],
  loadError: null,
  togglePhase: "idle",
  toggleError: null,
};

export function recurringListReducer(
  state: RecurringListState,
  action: RecurringListAction,
): RecurringListState {
  switch (action.type) {
    case "loadStarted":
      return { ...state, loadPhase: "loading", loadError: null };
    case "loadSucceeded":
      return { ...state, loadPhase: "success", configs: action.configs, loadError: null };
    case "loadFailed":
      return { ...state, loadPhase: "error", loadError: action.message };
    case "toggleStarted":
      return { ...state, togglePhase: "loading", toggleError: null };
    case "toggleSucceeded":
      return {
        ...state,
        togglePhase: "success",
        configs: state.configs.map((c) =>
          c.id === action.config.id ? action.config : c,
        ),
        toggleError: null,
      };
    case "toggleFailed":
      return { ...state, togglePhase: "error", toggleError: action.message };
    default:
      return state;
  }
}

export interface RecurringFormState {
  submitPhase: "idle" | "publishing" | "saved";
  submitError: string | null;
}

export type RecurringFormAction =
  | { type: "submitStarted" }
  | { type: "submitSucceeded" }
  | { type: "submitFailed"; message: string };

export const initialRecurringFormState: RecurringFormState = {
  submitPhase: "idle",
  submitError: null,
};

export function recurringFormReducer(
  state: RecurringFormState,
  action: RecurringFormAction,
): RecurringFormState {
  switch (action.type) {
    case "submitStarted":
      return { ...state, submitPhase: "publishing", submitError: null };
    case "submitSucceeded":
      return { ...state, submitPhase: "saved", submitError: null };
    case "submitFailed":
      return { ...state, submitPhase: "idle", submitError: action.message };
    default:
      return state;
  }
}
