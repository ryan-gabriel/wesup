"use client";

import {
    createContext,
    useCallback,
    useContext,
    useReducer,
    useEffect,
    ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
    id: string;
    variant: ToastVariant;
    message: string;
    duration?: number; // ms — default 4000
}

type Action =
    | { type: "ADD"; toast: Toast }
    | { type: "REMOVE"; id: string };

// ── Reducer ────────────────────────────────────────────────────────────────

function reducer(state: Toast[], action: Action): Toast[] {
    switch (action.type) {
        case "ADD":
            return [...state, action.toast];
        case "REMOVE":
            return state.filter((t) => t.id !== action.id);
        default:
            return state;
    }
}

// ── Context ────────────────────────────────────────────────────────────────

interface ToastContextValue {
    toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
    return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, dispatch] = useReducer(reducer, []);

    const toast = useCallback(
        (message: string, variant: ToastVariant = "info", duration = 4000) => {
            const id = crypto.randomUUID();
            dispatch({ type: "ADD", toast: { id, variant, message, duration } });
        },
        []
    );

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <ToastContainer toasts={toasts} dispatch={dispatch} />
        </ToastContext.Provider>
    );
}

// ── Container ──────────────────────────────────────────────────────────────

function ToastContainer({
    toasts,
    dispatch,
}: {
    toasts: Toast[];
    dispatch: React.Dispatch<Action>;
}) {
    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        >
            {toasts.map((t) => (
                <ToastItem
                    key={t.id}
                    toast={t}
                    onClose={() => dispatch({ type: "REMOVE", id: t.id })}
                />
            ))}
        </div>
    );
}

// ── Single Toast ───────────────────────────────────────────────────────────

const variantStyles: Record<ToastVariant, string> = {
    success: "bg-emerald-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-amber-500 text-white",
    info: "bg-gray-900 text-white",
};

const variantIcons: Record<ToastVariant, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
};

function ToastItem({
    toast,
    onClose,
}: {
    toast: Toast;
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onClose, toast.duration ?? 4000);
        return () => clearTimeout(timer);
    }, [toast.duration, onClose]);

    return (
        <div
            role="alert"
            className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg",
                "min-w-[260px] max-w-sm text-sm font-medium",
                "animate-in slide-in-from-right-4 fade-in duration-200",
                variantStyles[toast.variant]
            )}
        >
            <span className="shrink-0 text-base">{variantIcons[toast.variant]}</span>
            <span className="flex-1">{toast.message}</span>
            <button
                onClick={onClose}
                aria-label="Tutup notifikasi"
                className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
                ✕
            </button>
        </div>
    );
}
