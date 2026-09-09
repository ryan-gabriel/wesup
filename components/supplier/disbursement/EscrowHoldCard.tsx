import { Clock3, PackageCheck, User, Wallet } from "lucide-react";
import type { EscrowHold } from "@/lib/supplier-disbursement/types";
import EscrowStatusBadge from "@/components/supplier/report/EscrowStatusBadge";

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export interface EscrowHoldCardProps {
  hold: EscrowHold;
}

export default function EscrowHoldCard({ hold }: EscrowHoldCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              {hold.batchTitle}
            </h2>
            <EscrowStatusBadge status={hold.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{hold.batchDisplayCode}</p>
        </div>
        <p className="text-lg font-bold text-slate-900">
          {money.format(hold.amount)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <User
            size={16}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <div>
            <dt className="text-xs text-slate-400">UMKM</dt>
            <dd className="font-semibold text-slate-700">{hold.umkmName}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PackageCheck
            size={16}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <div>
            <dt className="text-xs text-slate-400">Pengambilan dikonfirmasi</dt>
            <dd className="font-semibold text-slate-700">
              {dates.format(new Date(hold.pickupConfirmedAt))}
            </dd>
          </div>
        </div>
        {hold.status === "held" && hold.autoReleaseAt && (
          <div className="flex items-center gap-2">
            <Clock3
              size={16}
              className="shrink-0 text-blue-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-xs text-slate-400">Rilis otomatis setelah 24 jam</dt>
              <dd className="font-semibold text-blue-700">
                {dates.format(new Date(hold.autoReleaseAt))}
              </dd>
            </div>
          </div>
        )}
        {hold.releaseDestination && (
          <div className="flex items-center gap-2">
            <Wallet
              size={16}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div>
              <dt className="text-xs text-slate-400">Dana dialihkan ke</dt>
              <dd className="font-semibold text-slate-700">
                {hold.releaseDestination === "supplier"
                  ? "Supplier"
                  : "UMKM (pengembalian)"}
              </dd>
            </div>
          </div>
        )}
      </dl>
    </div>
  );
}
