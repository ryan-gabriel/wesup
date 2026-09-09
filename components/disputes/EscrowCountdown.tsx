"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} jam ${minutes} menit`;
}

export default function EscrowCountdown({
  deadlineAt,
  label = "Sisa jendela komplain",
}: {
  deadlineAt: string;
  label?: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () =>
      setRemaining(new Date(deadlineAt).getTime() - Date.now());
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [deadlineAt]);

  if (remaining === null) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <Clock3 aria-hidden="true" size={16} />
        Menghitung waktu tersisa…
      </p>
    );
  }

  const expired = remaining <= 0;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold",
        expired
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-800",
      )}
    >
      <Clock3 aria-hidden="true" size={16} />
      {expired
        ? "Jendela komplain telah ditutup"
        : `${label}: ${formatRemaining(remaining)}`}
    </p>
  );
}