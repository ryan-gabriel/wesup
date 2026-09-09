import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Tag, Users } from "lucide-react";
import type { MarketplaceItem } from "@/lib/marketplace/types";

const rupiahFormatter = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const closingTimeFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export interface ProductCardProps { item: MarketplaceItem; }

function formatClosingTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Waktu tutup belum tersedia" : closingTimeFormatter.format(date);
}

export default function ProductCard({ item }: ProductCardProps) {
  const progress = item.targetQuantity <= 0 ? 0 : Math.min(100, Math.round((item.registeredQuantity / item.targetQuantity) * 100));
  return (
    <Link href={`/marketplace/${encodeURIComponent(item.id)}`} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col h-full focus:outline-none focus:ring-2 focus:ring-blue-500/30">
      <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
        <Image src={item.imageUrl} alt={`Foto produk ${item.title}`} fill sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw" className="object-cover" />
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 shadow-sm border border-white">{item.category}</div>
      </div>
      <div className="p-4 flex flex-col flex-1 gap-4">
        <div className="space-y-1"><h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">{item.title}</h3><p className="text-sm font-medium text-slate-500">{item.supplierName}</p></div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 whitespace-nowrap"><MapPin aria-hidden="true" className="w-4 h-4 text-slate-400" /><span>{item.distanceKm === null ? "Jarak belum tersedia" : `${item.distanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`}</span></div>
          <div className="flex items-center gap-2 whitespace-nowrap"><Clock aria-hidden="true" className="w-4 h-4 text-slate-400" /><span>{item.estimatedPickupMinutes === null ? "Estimasi belum tersedia" : `${item.estimatedPickupMinutes} mnt (Pickup)`}</span></div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Clock aria-hidden="true" className="w-4 h-4 text-slate-400 flex-shrink-0" /><span>Tutup {formatClosingTime(item.registrationClosesAt)}</span></div>
        <div className="mt-auto pt-2"><div className="flex items-center gap-2 mb-1.5"><Tag aria-hidden="true" className="w-4 h-4 text-emerald-500" /><span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Tier Diskon</span></div><div className="flex items-end gap-2"><span className="text-2xl font-black text-slate-900 tracking-tight">{rupiahFormatter.format(item.currentTierPrice)}</span><span className="text-sm font-medium text-slate-400 line-through mb-1">{rupiahFormatter.format(item.basePrice)}</span></div></div>
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-100"><div className="flex items-center justify-between text-xs"><div className="flex items-center gap-2 font-semibold text-blue-700"><Users aria-hidden="true" className="w-4 h-4" /><span>Target Kelompok: {item.registeredQuantity}/{item.targetQuantity} Porsi</span></div><span className="font-bold text-slate-700">{progress}%</span></div><div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner" role="progressbar" aria-label="Progres target kelompok" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>
      </div>
    </Link>
  );
}
