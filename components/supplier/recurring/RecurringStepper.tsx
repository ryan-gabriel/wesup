"use client";

import { Check } from "lucide-react";
import {
  RECURRING_STEPS,
  type RecurringDraftStep,
} from "@/lib/supplier-recurring/types";

export default function RecurringStepper({
  currentStep,
}: {
  currentStep: RecurringDraftStep;
}) {
  const currentLabel = RECURRING_STEPS[currentStep - 1].label;

  return (
    <nav aria-label="Progress pembuatan jadwal">
      <ol className="grid grid-cols-3">
        {RECURRING_STEPS.map((step, index) => {
          const complete = step.id < currentStep;
          const current = step.id === currentStep;
          const status = complete
            ? "Selesai"
            : current
              ? "Langkah aktif"
              : "Belum dimulai";

          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center"
            >
              {index < RECURRING_STEPS.length - 1 && (
                <span
                  className={`absolute left-1/2 top-5 h-px w-full ${
                    complete ? "bg-blue-600" : "bg-slate-200"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-colors ${
                  complete
                    ? "border-blue-600 bg-blue-600 text-white"
                    : current
                      ? "border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100"
                      : "border-slate-300 bg-white text-slate-500"
                }`}
                aria-hidden="true"
              >
                {complete ? (
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  step.id
                )}
              </span>
              <span className="mt-2 max-w-full truncate px-1 text-center text-[10px] font-semibold text-slate-500 sm:hidden">
                {step.shortLabel}
              </span>
              <span
                className={`mt-2 hidden max-w-full truncate px-1 text-center text-xs font-semibold sm:block ${
                  current || complete ? "text-blue-700" : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
              <span className="sr-only">
                {step.label}: {status}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Langkah {currentStep} dari 3: {currentLabel}
      </p>
    </nav>
  );
}
