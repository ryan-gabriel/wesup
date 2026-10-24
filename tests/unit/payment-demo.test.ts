import { describe, expect, it } from "vitest";
import { paymentDemoFor } from "@/lib/payments/demo";
import { providerPaymentMismatch } from "@/lib/payments/provider-validation";
import { toUmkmOrderDetail, type OrderReadRow } from "@/lib/orders/read-model";
const user = "11111111-1111-4111-8111-111111111111", batch = "22222222-2222-4222-8222-222222222222";
const now = "2026-10-24T08:00:00Z";
const env = {PAYMENT_DEMO_ENABLED:"true",MIDTRANS_IS_PRODUCTION:"false",PAYMENT_DEMO_ALLOWED_UMKM_IDS:user,PAYMENT_DEMO_ALLOWED_BATCH_IDS:batch};
const row: OrderReadRow = {id:user,batch_id:batch,status:"pending_payment",quantity:1,final_amount:10000,locked_tier_number:1,created_at:now,batch:{status:"closed",batch_timeline:{registration_opens_at:now,registration_closes_at:now,payment_opens_at:"2026-10-24T07:00:00Z",payment_closes_at:"2026-10-24T09:00:00Z",estimated_ready_at:"2026-10-25T08:00:00Z"}},payment:{id:batch,status:"pending",gross_amount:10000,midtrans_order_id:"legacy",payment_attempts:[{id:batch,provider_order_id:"checkout",status:"pending",integration_type:"snap",provider_status:"pending",expires_at:"2026-10-24T09:00:00Z",created_at:now}]}};
const detail=()=>toUmkmOrderDetail(row,now);
describe("sandbox payment eligibility",()=>{
 it("permits an allowlisted open checkout even when provider checks fail",()=>expect(paymentDemoFor(detail(),user,true,env)).toMatchObject({enabled:true,canSimulatePaid:true,checkoutReference:"checkout"}));
 it.each([{MIDTRANS_IS_PRODUCTION:"true"},{MIDTRANS_IS_PRODUCTION:undefined},{PAYMENT_DEMO_ENABLED:"false"},{PAYMENT_DEMO_ALLOWED_UMKM_IDS:"*"},{PAYMENT_DEMO_ALLOWED_BATCH_IDS:""}])("fails closed for %j",changes=>expect(paymentDemoFor(detail(),user,true,{...env,...changes}).enabled).toBe(false));
 it("does not grant another account access",()=>expect(paymentDemoFor(detail(),batch,true,env).enabled).toBe(false));
 it("blocks suspended users",()=>expect(paymentDemoFor(detail(),user,false,env).canSimulatePaid).toBe(false));
 it.each(["creating","failed","expired"])("rejects %s attempts",status=>{const d=detail();d.paymentAttempt!.status=status;expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
 it("requires checkout creation",()=>{const d=detail();d.paymentAttempt=null;expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
 it("does not treat a legacy attempt without a stored QR as a completed checkout",()=>{const d=detail();d.paymentAttempt!.checkoutMode="core_qris";d.paymentAttempt!.qrCodeUrl=null;expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
 it("accepts a persisted legacy QR checkout",()=>{const d=detail();d.paymentAttempt=null;d.invoice!.qrCodeUrl="https://example.test/qr";d.invoice!.qrCodeExpiresAt="2026-10-24T09:00:00Z";expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(true);});
 it("blocks at the deadline",()=>{const d=detail();d.serverTime=d.timeline.paymentClosesAt!;expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
 it("blocks before opening",()=>{const d=detail();d.serverTime="2026-10-24T06:00:00Z";expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
 it("blocks inconsistent invoices",()=>{const d=detail();d.invoice!.grossAmount=9000;expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
 it.each(["cancelled","refund_pending","no_show"])("blocks %s orders",status=>{const d=detail();d.status=status as typeof d.status;expect(paymentDemoFor(d,user,true,env).canSimulatePaid).toBe(false);});
});
describe("safe provider mismatch diagnostics",()=>{
 const raw={order_id:"checkout",gross_amount:"10000.00",transaction_status:"pending",merchant_id:"m",currency:"IDR"};
 it("accepts matching data",()=>expect(providerPaymentMismatch(raw,"checkout",10000,"m")).toBeNull());
 it.each([[{order_id:"wrong"},"order_id"],[{gross_amount:"9999"},"amount"],[{currency:"USD"},"currency"],[{merchant_id:"wrong"},"merchant"],[{transaction_status:"wat"},"status"],[{transaction_status:"capture",fraud_status:"challenge"},"fraud"]])("categorizes %j",(change,reason)=>expect(providerPaymentMismatch({...raw,...change as object},"checkout",10000,"m")).toBe(reason));
});
