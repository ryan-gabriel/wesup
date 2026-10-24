// @vitest-environment jsdom
import { act,fireEvent,screen,waitFor } from "@testing-library/react";
import { afterEach,describe,it,expect,vi } from "vitest";
import {renderComponent as render} from "./test-utils";
import {DemoPaymentAction} from "@/components/payments/DemoPaymentAction";
import type {UmkmOrderDetail} from "@/lib/orders/api-types";
Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value:function(){this.setAttribute("open","");}});
Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value:function(){this.removeAttribute("open");}});
const order={id:"11111111-1111-4111-8111-111111111111",batchDisplayCode:"BATCH-DEMO",status:"pending_payment",invoice:{grossAmount:10000},paymentDemo:{enabled:true,canSimulatePaid:true,checkoutReference:"checkout",blockedReason:null}} as UmkmOrderDetail;
const props=()=>({order,busy:false,begin:vi.fn(()=>true),end:vi.fn(),onReload:vi.fn(),onSettled:vi.fn()});
afterEach(()=>vi.unstubAllGlobals());
async function confirm(){fireEvent.click(screen.getByRole("button",{name:"Pembayaran lunas"}));await waitFor(()=>expect(screen.getByRole("dialog")).toBeInTheDocument());fireEvent.click(screen.getByRole("button",{name:"Konfirmasi pelunasan demo"}));}
describe("demo settlement action",()=>{
 it("confirms exact invoice without opening or generating a QR",async()=>{const p=props();const fetcher=vi.fn(async(url: string)=>{expect(url).toContain("/simulate-paid");return {ok:true,json:async()=>({simulated:true,order:{...order,status:"paid"}})};});vi.stubGlobal("fetch",fetcher);render(<DemoPaymentAction {...p}/>);await confirm();await waitFor(()=>expect(p.onSettled).toHaveBeenCalledWith(expect.objectContaining({status:"paid"})));expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toBe(`/api/umkm/orders/${order.id}/payment/simulate-paid`);expect(p.onReload).toHaveBeenCalled();});
 it("does not submit when another payment operation owns the lock",async()=>{const p=props();p.begin.mockReturnValue(false);const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);render(<DemoPaymentAction {...p}/>);await confirm();expect(fetcher).not.toHaveBeenCalled();});
 it("reads after an uncertain result and never automatically replays",async()=>{const p=props();const fetcher=vi.fn(async()=>{throw new Error("network disconnected");});vi.stubGlobal("fetch",fetcher);render(<DemoPaymentAction {...p}/>);await confirm();await waitFor(()=>expect(p.onReload).toHaveBeenCalledTimes(1));expect(p.onSettled).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.getByRole("button",{name:"Pembayaran lunas"})).toBeDisabled();});
 it("rejects an obsolete response containing another order",async()=>{const p=props();vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({simulated:true,order:{...order,id:"other"}})})));render(<DemoPaymentAction {...p}/>);await confirm();await waitFor(()=>expect(p.onReload).toHaveBeenCalled());expect(p.onSettled).not.toHaveBeenCalled();});
 it("does not present an unchanged pending snapshot as success",async()=>{const p=props();vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({simulated:true,order})})));render(<DemoPaymentAction {...p}/>);await confirm();await waitFor(()=>expect(p.onReload).toHaveBeenCalled());expect(p.onSettled).not.toHaveBeenCalled();});
 it("ignores a response after the order component unmounts",async()=>{const p=props();let resolve:(v:unknown)=>void=()=>{};vi.stubGlobal("fetch",vi.fn(()=>new Promise(r=>{resolve=r;})));const view=render(<DemoPaymentAction {...p}/>);await confirm();view.unmount();await act(async()=>resolve({ok:true,json:async()=>({simulated:true,order:{...order,status:"paid"}})}));expect(p.onSettled).not.toHaveBeenCalled();});
 it("cannot open confirmation while busy",()=>{render(<DemoPaymentAction {...props()} busy/>);expect(screen.getByRole("button",{name:"Pembayaran lunas"})).toBeDisabled();});
 it("is absent after payment is already paid",()=>{render(<DemoPaymentAction {...props()} order={{...order,status:"paid"}}/>);expect(screen.queryByRole("button",{name:"Pembayaran lunas"})).not.toBeInTheDocument();});
});
