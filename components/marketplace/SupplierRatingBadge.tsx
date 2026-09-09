import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SupplierRatingBadgeValue {
  average: number;
  total: number;
}

const FULL_STARS = [1, 2, 3, 4, 5];

function formatAverage(average: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

function filledStars(average: number): number {
  return Math.round(average);
}

export default function SupplierRatingBadge({
  rating,
}: {
  rating: SupplierRatingBadgeValue | null;
}) {
  if (!rating || rating.total <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Star aria-hidden="true" className="h-3.5 w-3.5 text-slate-300" />
        Belum ada penilaian
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700"
      aria-label={`Rating ${formatAverage(rating.average)} dari 5, ${rating.total} ulasan`}
    >
      <span className="flex gap-0.5">
        {FULL_STARS.map((value) => (
          <Star
            key={value}
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5",
              value <= filledStars(rating.average)
                ? "text-amber-500"
                : "text-slate-200",
            )}
            fill={value <= filledStars(rating.average) ? "currentColor" : "none"}
          />
        ))}
      </span>
      {formatAverage(rating.average)}
      <span className="font-medium text-slate-400">
        ({rating.total} ulasan)
      </span>
    </span>
  );
}