"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Timer } from "lucide-react";

interface PaymentCountdownProps {
  /** Waktu absolut dari respons API Gatekeeper (mock) — sumber kebenaran. */
  serverNowIso: string;
  /** Target countdown (pembukaan atau penutupan window). */
  deadlineIso: string;
  tone: "info" | "warning" | "danger";
}

const TONE_CLASSES = {
  info: {
    wrap: "bg-indigo-50 border-indigo-200 text-indigo-700",
    digits: "text-indigo-800",
    note: "text-indigo-500",
  },
  warning: {
    wrap: "bg-amber-50 border-amber-200 text-amber-700",
    digits: "text-amber-800",
    note: "text-amber-600",
  },
  danger: {
    wrap: "bg-rose-50 border-rose-200 text-rose-700",
    digits: "text-rose-800",
    note: "text-rose-600",
  },
} as const;

function toParts(remainingMs: number): { h: string; m: string; s: string } {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return { h, m, s };
}

/**
 * Countdown yang di-anchor ke `serverNowIso` (server timestamp) — perangkat
 * klien hanya menyediakan delta relatif antar detik, bukan waktu absolut,
 * sehingga jam lokal tidak dapat memanipulasi batas waktu Payment Window.
 */
export default function PaymentCountdown({
  serverNowIso,
  deadlineIso,
  tone,
}: PaymentCountdownProps) {
  const initialRemainingMs = useMemo(() => {
    const initial = Date.parse(deadlineIso) - Date.parse(serverNowIso);
    return Number.isNaN(initial) ? 0 : initial;
  }, [serverNowIso, deadlineIso]);

  const [remainingMs, setRemainingMs] = useState(initialRemainingMs);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    const tick = () => {
      const elapsed = Date.now() - (startedAtRef.current as number);
      setRemainingMs(Math.max(0, initialRemainingMs - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [initialRemainingMs]);

  const parts = toParts(remainingMs);
  const toneClass = TONE_CLASSES[tone];

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label="Hitung mundur berdasarkan waktu server"
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${toneClass.wrap}`}
    >
      <Timer aria-hidden="true" className="h-4 w-4" />
      <span className="font-mono text-lg font-bold tabular-nums tracking-tight">
        {parts.h}:{parts.m}:{parts.s}
      </span>
      <span className={`text-[11px] font-medium ${toneClass.note}`}>Waktu server</span>
    </div>
  );
}