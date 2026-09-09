import ProductSkeleton from "@/components/marketplace/ProductSkeleton";

export default function MarketplaceLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Memuat marketplace" aria-busy="true">
      <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <ProductSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
