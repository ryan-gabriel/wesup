import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { StrikeLevel } from "@/lib/payments/types";

const STRIKE_POLICY: Record<
  StrikeLevel,
  { label: string; description: string }
> = {
  1: {
    label: "Peringatan WhatsApp",
    description:
      "Pelanggaran ke-1. Hit & Run terdeteksi — peringatan otomatis dikirim, akun tetap aktif.",
  },
  2: {
    label: "Suspend Sementara 7 Hari",
    description:
      "Pelanggaran ke-2. Akun ditangguhkan 7 hari terhitung sejak batas akhir Payment Window.",
  },
  3: {
    label: "Suspend Permanen",
    description:
      "Pelanggaran ke-3. Akun ditangguhkan permanen dan kehilangan akses ke order/batch baru.",
  },
};

export default function HitAndRunBanner({
  strikes,
}: {
  strikes: StrikeLevel;
}) {
  const current = STRIKE_POLICY[strikes];

  return (
    <section
      role="alert"
      aria-label="Peringatan sanksi Hit and Run"
      className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100">
          <ShieldAlert aria-hidden="true" className="h-5 w-5 text-rose-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-rose-800">
            Pembayaran terlewat — Sanksi Hit & Run
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-rose-700">
            Jendela pembayaran sudah ditutup dan tagihan tidak dapat diproses.
            Sistem menjatuhkan sanksi berjenjang bagi UMKM yang gagal membayar.
          </p>

          <ul className="mt-3 space-y-1.5">
            {([1, 2, 3] as const).map((level) => {
              const policy = STRIKE_POLICY[level];
              const isCurrent = level === strikes;
              return (
                <li
                  key={level}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    isCurrent
                      ? "bg-rose-100 font-bold text-rose-800"
                      : "bg-white/60 text-rose-600"
                  }`}
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isCurrent ? "text-rose-700" : "text-rose-400"
                    }`}
                  />
                  <span>
                    {level}. {policy.label}
                    {isCurrent ? (
                      <span className="ml-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {current.description}
                      </span>
                    ) : (
                      <span className="text-rose-500"> — {policy.description}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}