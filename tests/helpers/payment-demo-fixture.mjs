// Loopback-only UI fixture: real payment SQL in PGlite, no hosted credentials or accounts.
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function servePaymentDemo({db,fixture,settle}){
 const root=path.resolve('node_modules/.cache/payment-demo-ui');await mkdir(root,{recursive:true});
 await writeFile(path.join(root,'index.html'),`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.resolve('tests/helpers/payment-demo-ui.tsx').replaceAll('\\','/')}"></script></body></html>`);
 await writeFile(path.join(root,'link.tsx'),`import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`);
 const f=await fixture();await db.query('delete from payment_checkout_sessions where payment_attempt_id=$1',[f.a]);await db.query('delete from payment_attempts where id=$1',[f.a]);
 let created=false;
 async function snapshot(){
  const r=(await db.query('select status from registrations where id=$1',[f.r])).rows[0];const paid=r.status==='paid';const now=new Date().toISOString();const opens=new Date(Date.now()-3600000).toISOString(),closes=new Date(Date.now()+3600000).toISOString();
  return {id:f.r,batchId:f.b,batchTitle:'Pesanan uji pelunasan demo',batchDisplayCode:'BATCH-DEMO',supplierName:'Supplier disposable',batchStatus:'closed',quantity:1,unit:'kg',status:r.status,phase:paid?'paid_waiting_ready':'payment_open',finalAmount:10000,lockedTier:1,lockedUnitPrice:10000,createdAt:now,serverTime:now,timeline:{paymentOpensAt:opens,paymentClosesAt:closes,estimatedReadyAt:closes,registrationClosesAt:opens,pickupDeadlineAt:null,complaintDeadlineAt:null},capabilities:{canPay:!paid},invoice:{paymentId:f.p,grossAmount:10000,status:paid?'paid':'pending',midtransOrderId:f.ref,qrCodeUrl:null,qrCodeExpiresAt:closes,paidAt:paid?now:null},paymentAttempt:created?{id:f.a,providerOrderId:f.ref,status:paid?'paid':'pending',checkoutMode:'snap',providerStatus:paid?'settlement':'pending',expiresAt:closes,qrCodeUrl:null,paymentMethod:null}:null,paymentProgress:{state:paid?'paid':created?'checkout_created':'checkout_ready',canOpenCheckout:!paid,canCheckStatus:created&&!paid,lastCheckedAt:null,blockedReason:null},paymentDemo:{enabled:true,canSimulatePaid:created&&!paid,blockedReason:created?null:'Buat checkout pembayaran terlebih dahulu.',checkoutReference:created?f.ref:null},pickup:null,escrow:paid?{amount:10000,status:'held'}:null,refund:null,dispute:null,rating:null};
 }
 const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:3217,strictPort:true,fs:{allow:[process.cwd()]}},esbuild:{jsx:'automatic'},resolve:{alias:{'@':process.cwd(),'next/link':path.join(root,'link.tsx')}},plugins:[{name:'fixture-payment-api',configureServer(v){v.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/api/'))return next();res.setHeader('content-type','application/json');try{
 if(req.url.endsWith('/charge')){created=true;await db.query(`insert into payment_attempts(id,payment_id,provider_order_id,status,integration_type,provider_status,expires_at,created_at) values($1,$2,$3,'pending','snap','pending',now()+interval '1 hour',now())`,[f.a,f.p,f.ref]);await db.query(`insert into payment_checkout_sessions values($1,'fixture-token','https://fixture/checkout',now()+interval '1 hour',null)`,[f.a]);const o=await snapshot();res.end(JSON.stringify({attempt:{...o.paymentAttempt,snapToken:'fixture-token',redirectUrl:'https://fixture/checkout'},serverTime:o.serverTime}));return;}
 if(req.url.endsWith('/simulate-paid')){await settle(f);res.end(JSON.stringify({simulated:true,duplicate:false,order:await snapshot()}));return;}
 if(req.url.endsWith('/reconcile')){res.statusCode=502;res.end(JSON.stringify({error:'Fixture provider mismatch',code:'PAYMENT_PROVIDER_MISMATCH'}));return;}
 res.end(JSON.stringify(await snapshot()));
 }catch{res.statusCode=409;res.end(JSON.stringify({error:'Fixture rejected'}));}});}}]});
 await server.listen();console.log('Isolated demo UI ready at http://127.0.0.1:3217');
 await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});await server.close();
}
