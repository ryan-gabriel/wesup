import { Skeleton } from "@/components/ui/SkeletonLoading";

export default function ProductSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full animate-pulse motion-reduce:animate-none"
    >
      <Skeleton className="w-full h-48 rounded-none bg-slate-200" />
      <div className="p-4 flex flex-col flex-1 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-4/5 rounded-md bg-slate-200" />
          <Skeleton className="h-4 w-1/2 rounded-md bg-slate-200" />
        </div>
        <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <Skeleton className="h-4 w-1/3 rounded-md bg-slate-200" />
          <Skeleton className="h-4 w-1/3 rounded-md bg-slate-200" />
        </div>
        <div className="mt-auto pt-2 space-y-2">
          <Skeleton className="h-3 w-1/3 rounded-md bg-slate-200" />
          <div className="flex items-end gap-2">
            <Skeleton className="h-8 w-3/5 rounded-md bg-slate-200" />
            <Skeleton className="mb-1 h-4 w-1/4 rounded-md bg-slate-200" />
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-3/5 rounded-md bg-slate-200" />
            <Skeleton className="h-3 w-1/6 rounded-md bg-slate-200" />
          </div>
          <Skeleton className="w-full h-2.5 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
