"use client";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { feedbackError } from "@/lib/feedback/errors";
const money=new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0});
export function DemoPaymentAction({order,busy,begin,end,onSettled,onReload}:{order:UmkmOrderDetail;busy:boolean;begin:()=>boolean;end:()=>void;onSettled:(order:UmkmOrderDetail)=>void;onReload:()=>void}) {
 const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(""),[uncertain,setUncertain]=useState(false);
 const active=useRef(true),controller=useRef<AbortController|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();};},[]);
 const demo=order.paymentDemo;
 async function submit(){
  if(!demo?.canSimulatePaid||!demo.checkoutReference||!begin())return;
  setPending(true);setError("");controller.current=new AbortController();
  try {
   const response=await fetch(`/api/umkm/orders/${order.id}/payment/simulate-paid`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkoutReference:demo.checkoutReference}),signal:controller.current.signal});
   const body=await response.json().catch(()=>({}));
   if(!active.current)return;
   if(!response.ok||!body.order||body.order.id!==order.id||body.simulated!==true||!["paid","picked_up","completed","refund_pending","refunded"].includes(body.order.status))throw new Error(body.error??"Hasil simulasi belum terkonfirmasi.");
   setOpen(false);onSettled(body.order);
   window.dispatchEvent(new Event("wesup:orders-updated"));
   try {window.localStorage.setItem("wesup:orders-updated",crypto.randomUUID());} catch { /* Storage restrictions must not hide a confirmed payment. */ }
   onReload();
  } catch(reason){
   if(!active.current)return;
   setError(feedbackError(reason,"Hasil simulasi belum terkonfirmasi. Periksa status pesanan sebelum mencoba lagi."));setUncertain(true);setOpen(false);onReload();
  } finally {end();if(active.current)setPending(false);}
 }
 if(!demo?.enabled||["paid","picked_up","completed","refund_pending","refunded"].includes(order.status))return null;
 return <section aria-label="Simulasi pembayaran" className="border border-wesup-ink/20 bg-wesup-paper-sub p-1.5"><div className="border border-wesup-ink/15 bg-wesup-paper p-4 sm:p-5">
  <h2 className="font-mono text-xs uppercase tracking-[0.14em]">Simulasi pembayaran · Sandbox</h2>
  <p className="mt-3 text-sm leading-6 text-wesup-ink-sub">Untuk pengujian. Tidak ada transfer uang atau pembayaran nyata.</p>
  <button type="button" disabled={busy||uncertain||!demo.canSimulatePaid} onClick={()=>setOpen(true)} className="mt-4 min-h-11 border border-wesup-ink bg-wesup-ink px-5 py-2.5 text-sm font-semibold text-wesup-paper transition-colors duration-300 wesup-ease hover:bg-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red disabled:opacity-50">Pembayaran lunas</button>
  {demo.blockedReason&&<p className="mt-3 text-sm text-wesup-ink-sub">{demo.blockedReason}</p>}
  {uncertain&&<div role="alert" className="mt-3 text-sm"><p>{error}</p><button type="button" disabled={busy} onClick={onReload} className="mt-2 min-h-11 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-wesup-red">Periksa status pesanan</button></div>}
  <ConfirmDialog open={open} title="Lunasi pembayaran demo?" description={<><p>Pesanan {order.batchDisplayCode} · {order.id.slice(0,8)}</p><p className="mt-2 font-semibold tabular-nums">{money.format(order.invoice?.grossAmount??0)}</p><p className="mt-2">Mencatat pelunasan sandbox tanpa transfer uang. Jadwal dan kesiapan Supplier tetap berlaku.</p></>} confirmLabel="Konfirmasi pelunasan demo" pending={pending} error={error} onCancel={()=>setOpen(false)} onConfirm={()=>void submit()} />
 </div></section>;
}
