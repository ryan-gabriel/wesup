import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/umkm/workspace-auth",()=>({resolveActiveUmkm:mocks.auth}));
vi.mock("@/lib/supabase/admin",()=>({getAdminClient:mocks.admin}));
import {GET} from "@/app/api/umkm/orders/[orderId]/route";
const user="11111111-1111-4111-8111-111111111111",batch="22222222-2222-4222-8222-222222222222";
let session: Record<string,unknown>|null;
beforeEach(()=>{
 vi.clearAllMocks();for(const [key,value] of Object.entries({PAYMENT_DEMO_ENABLED:"true",MIDTRANS_IS_PRODUCTION:"false",PAYMENT_DEMO_ALLOWED_UMKM_IDS:user,PAYMENT_DEMO_ALLOWED_BATCH_IDS:batch}))vi.stubEnv(key,value);
 const now=new Date().toISOString(),opens=new Date(Date.now()-3600000).toISOString(),closes=new Date(Date.now()+3600000).toISOString();
 const row={id:user,batch_id:batch,quantity:1,status:"pending_payment",final_amount:10000,locked_tier_number:1,created_at:now,batch:{status:"closed",batch_timeline:{registration_opens_at:opens,registration_closes_at:opens,payment_opens_at:opens,payment_closes_at:closes,estimated_ready_at:closes}},payment:{id:batch,status:"pending",gross_amount:10000,payment_attempts:[{id:batch,provider_order_id:"checkout",status:"pending",integration_type:"snap",provider_status:"pending",created_at:now,expires_at:closes}]}};
 const query={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:row,error:null}))};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);
 mocks.auth.mockResolvedValue({client:{from:()=>query},context:{userId:user,status:"active"}});
 session={id:batch,expires_at:closes,cancelled_at:null};
 const privateQuery={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn(async()=>({data:session,error:null}))};privateQuery.select.mockReturnValue(privateQuery);privateQuery.eq.mockReturnValue(privateQuery);mocks.admin.mockReturnValue({from:()=>privateQuery});
});
afterEach(()=>vi.unstubAllEnvs());
const read=async()=>{const r=await GET(new Request("http://localhost/order"),{params:Promise.resolve({orderId:user})});expect(r.status).toBe(200);return r.json();};
describe("demo metadata checks persisted Snap session",()=>{
 it("enables a persisted session without exposing tokens or allowlists",async()=>{const body=await read();expect(body.paymentDemo).toMatchObject({enabled:true,canSimulatePaid:true,checkoutReference:"checkout"});expect(JSON.stringify(body)).not.toContain("PAYMENT_DEMO_ALLOWED");});
 it("blocks an attempt whose private checkout session is missing",async()=>{session=null;expect((await read()).paymentDemo.canSimulatePaid).toBe(false);});
 it("blocks cancelled checkout sessions",async()=>{session!.cancelled_at=new Date().toISOString();expect((await read()).paymentDemo.canSimulatePaid).toBe(false);});
 it("fails closed if the private session cannot be read",async()=>{mocks.admin.mockImplementation(()=>{throw new Error("not configured");});expect((await read()).paymentDemo).toMatchObject({enabled:true,canSimulatePaid:false,checkoutReference:null});});
});
