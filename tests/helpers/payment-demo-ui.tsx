import React,{useCallback,useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import UmkmPaymentPanel from "@/components/payments/UmkmPaymentPanel";
import type {UmkmOrderDetail} from "@/lib/orders/api-types";
import "@/app/globals.css";
window.snap={pay:()=>{}};
function DemoFixture(){
 const [order,setOrder]=useState<UmkmOrderDetail|null>(null);
 const reload=useCallback(async()=>{const r=await fetch('/api/order');setOrder(await r.json());},[]);
 useEffect(()=>{const timer=window.setTimeout(()=>void reload(),0);return()=>window.clearTimeout(timer);},[reload]);
 return <main className="wesup-app mx-auto min-h-screen max-w-3xl bg-wesup-paper p-4 sm:p-8"><h1 className="mb-6 font-landing-display text-3xl">Pesanan uji demo</h1>{order&&<><p className="mb-5" role="status">{order.status==='paid'?'Lunas · barang disiapkan':'Menunggu pembayaran'}</p><UmkmPaymentPanel key={order.id} order={order} onReload={reload}/><p className="mt-6 text-sm">Supplier: {order.status==='paid'?'Pembayaran lunas · menunggu penyiapan':'Belum lunas'}</p></>}</main>;
}
createRoot(document.getElementById('root')!).render(<DemoFixture/>);
