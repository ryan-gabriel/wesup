import { NextResponse } from "next/server";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/admin/validation";
import { DETAIL_SELECT } from "@/lib/orders/selects";
import { toUmkmOrderDetail, type OrderReadRow } from "@/lib/orders/read-model";
import { paymentDemoEnabled, paymentDemoFor } from "@/lib/payments/demo";
import { acquirePaymentLock, releasePaymentLock } from "@/lib/payments/order-lock";
import { csfrRequireSameOrigin } from "@/lib/auth/csrf";
export const dynamic="force-dynamic";
interface DetailReader { from:(name:string)=>{select:(columns:string)=>{eq:(column:string,value:string)=>{eq:(column:string,value:string)=>{maybeSingle:()=>PromiseLike<{data:OrderReadRow|null;error:unknown}>}}}} }
export async function POST(request:Request,{params}:{params:Promise<{orderId:string}>}) {
 const csrf=csfrRequireSameOrigin(request);if(csrf)return csrf;
 const requestId=crypto.randomUUID();
 const fail=(error:string,code:string,status:number)=>NextResponse.json({error,code,requestId},{status,headers:{"Cache-Control":"no-store"}});
 const viewer=await resolveActiveUmkm(); if(!viewer.client)return viewer.response;
 if(viewer.context.status!=="active")return fail("Akun tidak aktif.","PAYMENT_DEMO_FORBIDDEN",403);
 const {orderId}=await params;if(!isUuid(orderId))return fail("Pesanan tidak ditemukan.","ORDER_NOT_FOUND",404);
 const limited=await enforceRateLimit(request,"route",viewer.context.userId);if(limited)return limited;
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.checkoutReference!=="string"||!body.checkoutReference.trim()||body.checkoutReference.length>255)return fail("Referensi checkout tidak valid.","INVALID_CHECKOUT",400);
 const read=async()=>(viewer.client as unknown as DetailReader).from("registrations").select(DETAIL_SELECT).eq("id",orderId).eq("umkm_id",viewer.context.userId).maybeSingle();
 const found=await read();if(found.error)return fail("Detail belum dapat dimuat.","PAYMENT_READ_FAILED",503);
 if(!found.data)return fail("Pesanan tidak ditemukan.","ORDER_NOT_FOUND",404);
 const row=found.data as unknown as OrderReadRow;
 if(!paymentDemoEnabled(viewer.context.userId,row.batch_id))return fail("Simulasi tidak tersedia.","PAYMENT_DEMO_DISABLED",403);
 const lock=await acquirePaymentLock(orderId);if(!lock.acquired)return fail("Pembayaran sedang diproses.","PAYMENT_BUSY",409);
 try {
   const admin=getAdminClient();
   const result=await admin.rpc("simulate_demo_payment_paid",{p_registration_id:orderId,p_actor_id:viewer.context.userId,p_batch_id:row.batch_id,p_checkout_reference:body.checkoutReference,p_request_id:requestId});
   if(result.error){const code=String(result.error.code??"");console.error("[payment-demo] settlement failed",{requestId,code});return fail("Simulasi belum berhasil. Muat ulang status pesanan sebelum mencoba lagi.",code==="PGRST202"?"PAYMENT_DEMO_SCHEMA_NOT_READY":"PAYMENT_DEMO_REJECTED",["22023","P0002","40P01","40001"].includes(code)?409:code==="42501"?403:503);}
   const refreshed=await read();if(refreshed.error||!refreshed.data)return fail("Hasil simulasi belum dapat dimuat. Periksa kembali status pesanan.","PAYMENT_READ_FAILED",503);
   const order=toUmkmOrderDetail(refreshed.data as unknown as OrderReadRow,new Date().toISOString());
   if(!["paid","picked_up","completed","refund_pending","refunded"].includes(order.status))return fail("Pelunasan belum terkonfirmasi pada status terbaru. Periksa kembali pesanan.","PAYMENT_DEMO_RESULT_UNCERTAIN",503);
   order.paymentDemo=paymentDemoFor(order,viewer.context.userId,true);
   return NextResponse.json({simulated:true,duplicate:!!(result.data as {duplicate?:boolean}|null)?.duplicate,order},{headers:{"Cache-Control":"no-store"}});
 } catch {return fail("Hasil simulasi belum terkonfirmasi. Muat ulang status pesanan.","PAYMENT_DEMO_UNAVAILABLE",503);}
 finally {await releasePaymentLock(orderId,lock.token);}
}
