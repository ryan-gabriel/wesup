export default function ProductSkeleton() {
  return (
    <div aria-hidden="true" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-full animate-pulse motion-reduce:animate-none">
      <div className="w-full h-48 bg-slate-200" />
      <div className="p-4 flex flex-col flex-1 gap-4">
        <div className="space-y-2"><div className="h-6 bg-slate-200 rounded-md w-4/5" /><div className="h-4 bg-slate-200 rounded-md w-1/2" /></div>
        <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100"><div className="h-4 bg-slate-200 rounded-md w-1/3" /><div className="h-4 bg-slate-200 rounded-md w-1/3" /></div>
        <div className="mt-auto pt-2 space-y-2"><div className="h-3 bg-slate-200 rounded-md w-1/3" /><div className="flex items-end gap-2"><div className="h-8 bg-slate-200 rounded-md w-3/5" /><div className="h-4 bg-slate-200 rounded-md w-1/4 mb-1" /></div></div>
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-100"><div className="flex justify-between items-center"><div className="h-3 bg-slate-200 rounded-md w-3/5" /><div className="h-3 bg-slate-200 rounded-md w-1/6" /></div><div className="w-full h-2.5 bg-slate-200 rounded-full" /></div>
      </div>
    </div>
  );
}
