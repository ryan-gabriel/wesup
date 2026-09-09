export default function MarketplaceDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8" aria-label="Memuat detail penawaran" aria-busy="true">
      <div className="h-5 w-48 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="aspect-[16/9] w-full animate-pulse bg-slate-200 motion-reduce:animate-none" />
        <div className="flex flex-col gap-5 p-5 md:p-8">
          <div className="h-9 w-3/4 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
            <div className="h-20 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
          <div className="h-28 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
