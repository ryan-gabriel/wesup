"use client";

import { useState } from "react";
import { Check, MapPin } from "lucide-react";

const consentTimestampFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export interface LocationConsentCheckboxProps {
  onChange: (checked: boolean, timestamp: Date | null) => void;
}

export default function LocationConsentCheckbox({
  onChange,
}: LocationConsentCheckboxProps) {
  const [checked, setChecked] = useState(false);
  const [timestamp, setTimestamp] = useState<Date | null>(null);

  function handleChange() {
    const next = !checked;
    setChecked(next);
    const ts = next ? new Date() : null;
    setTimestamp(ts);
    onChange(next, ts);
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label="Saya menyetujui lokasi pengambilan"
          onClick={handleChange}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
            checked
              ? "border-blue-600 bg-blue-600"
              : "border-slate-300 bg-white hover:border-blue-400"
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </button>
        <label
          className="text-sm text-slate-700 leading-relaxed cursor-pointer select-none"
          onClick={handleChange}
        >
          <span className="font-semibold text-slate-800">Persetujuan Lokasi Pengambilan</span>
          <span className="mt-1 block">
            Saya menyetujui dan memahami bahwa pengambilan barang dilakukan secara mandiri
            (self-pickup) di lokasi titik kumpul supplier.
          </span>
        </label>
      </div>

      {checked && timestamp && (
        <div
          aria-live="polite"
          className="flex items-center gap-2 ml-8 text-xs text-blue-700 font-medium"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Disetujui: {consentTimestampFormatter.format(timestamp)}</span>
        </div>
      )}
    </div>
  );
}
