// Runs real incumbent payment writers and the new migration in isolated PostgreSQL (PGlite).
import {PGlite} from '../../node_modules/.cache/wesup-availability/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;const q=async(s,a=[])=>(await db.query(s,a)).rows;
const check=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS',m);};
const extract=async(file,name)=>{const text=await readFile('supabase/migrations/'+file,'utf8');const f=text.match(new RegExp('create or replace function public\\.'+name+'\\([\\s\\S]*?\\$\\$;','i'))?.[0];assert.ok(f,name);await db.exec(f);};
try{
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create function public.is_admin() returns boolean language sql as $$select false$$;
create type registration_status as enum('registered','pending_payment','paid','cancelled','picked_up','completed','no_show','refund_pending','refunded');
create type payment_status as enum('pending','creating','paid','failed','expired','refunded');
create type batch_status as enum('published','closed','completed','cancelled','takedown');
create table profiles(id uuid primary key,role text,status text);
create table batches(id uuid primary key,status batch_status);
create table registrations(id uuid primary key,batch_id uuid,umkm_id uuid,status registration_status,final_amount numeric,locked_tier_number integer,updated_at timestamptz);
create table payments(id uuid primary key,registration_id uuid,status payment_status,gross_amount numeric,midtrans_order_id text,qr_code_url text,qr_code_expires_at timestamptz,midtrans_transaction_id text,paid_at timestamptz,webhook_payload jsonb,reconciled_at timestamptz,updated_at timestamptz);
create table payment_attempts(id uuid primary key,payment_id uuid,provider_order_id text,status payment_status,integration_type text,provider_status text,expires_at timestamptz,created_at timestamptz,payment_type text,provider_fraud_status text,provider_transaction_id text,provider_payload jsonb,updated_at timestamptz,qr_code_url text);
create table batch_timeline(batch_id uuid,payment_opens_at timestamptz,payment_closes_at timestamptz,effective_payment_opens_at timestamptz,effective_payment_closes_at timestamptz);
create table payment_checkout_sessions(payment_attempt_id uuid,snap_token text,redirect_url text,expires_at timestamptz,cancelled_at timestamptz);
create table escrow_holds(registration_id uuid unique,amount numeric,status text,pickup_confirmed_at timestamptz,auto_release_at timestamptz,release_destination text);
create table notifications(user_id uuid,type text,title text,message text,data jsonb);
create table transaction_logs(id uuid default gen_random_uuid(),registration_id uuid,payment_id uuid,payment_attempt_id uuid,event_type text,from_status payment_status,to_status payment_status,provider_status text,gateway_transaction_id text,payload jsonb,source text,actor_id uuid);
create table refund_requests(registration_id uuid unique,batch_id uuid,trigger_type text,amount numeric,status text);
`);
await extract('20260918010000_transaction_log.sql','record_transaction_log');
await extract('20260915100000_supplier_batch_transactions.sql','finalize_payment');
await extract('20261002000100_payment_continuation_guard.sql','apply_midtrans_payment_event');
await db.exec(await readFile('supabase/migrations/20261002000300_payment_status_audit_context.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261024160000_demo_payment_settlement.sql','utf8'));
const user=crypto.randomUUID();await q(`insert into profiles values($1,'umkm','active')`,[user]);
async function fixture(legacy=false){const b=crypto.randomUUID(),r=crypto.randomUUID(),p=crypto.randomUUID(),a=crypto.randomUUID(),ref='checkout:'+a;
 await q(`insert into batches values($1,'closed')`,[b]);await q(`insert into registrations values($1,$2,$3,'pending_payment',10000,1,null)`,[r,b,user]);
 await q(`insert into batch_timeline values($1,now()-interval '1 hour',now()+interval '1 hour',null,null)`,[b]);
 await q(`insert into payments(id,registration_id,status,gross_amount,midtrans_order_id,qr_code_url,qr_code_expires_at) values($1,$2,'pending',10000,$3,$4,now()+interval '1 hour')`,[p,r,ref,legacy?'https://fixture/qr':null]);
 if(!legacy){await q(`insert into payment_attempts(id,payment_id,provider_order_id,status,integration_type,provider_status,expires_at,created_at) values($1,$2,$3,'pending','snap','pending',now()+interval '1 hour',now())`,[a,p,ref]);await q(`insert into payment_checkout_sessions values($1,'fixture-token','https://fixture/checkout',now()+interval '1 hour',null)`,[a]);}
 return{b,r,p,a,ref};}
const settle=f=>q(`select simulate_demo_payment_paid($1,$2,$3,$4,$5) as result`,[f.r,user,f.b,f.ref,crypto.randomUUID()]);
for(const legacy of [false,true]){const f=await fixture(legacy);await settle(f);check((await q('select status from registrations where id=$1',[f.r]))[0].status==='paid',`${legacy?'legacy':'snap'} becomes paid`);await settle(f);check((await q('select count(*)::int n from escrow_holds where registration_id=$1',[f.r]))[0].n===1,'one escrow after replay');check((await q('select count(*)::int n from notifications where user_id=$1 and data->>\'registration_id\'=$2',[user,f.r]))[0].n===1,'one notification');const logs=await q('select * from transaction_logs where payment_id=$1',[f.p]);check(logs.length===1&&logs[0].source==='manual'&&logs[0].actor_id===user&&logs[0].payload.simulated===true,'explicit demo audit and actor');}
for(const [sql,message] of [
 [`update batch_timeline set payment_closes_at=now() where batch_id=$1`,'exact close'],
 [`update batch_timeline set payment_opens_at=now()+interval '1 hour' where batch_id=$1`,'before open'],
 [`update batches set status='takedown' where id=$1`,'takedown'],
 [`update payments set gross_amount=1 where registration_id=$1`,'amount mismatch'],
 [`update registrations set status='cancelled' where id=$1`,'cancelled'],
 [`update payment_attempts set status='expired' where payment_id=$1`,'expired checkout'],
 [`delete from payment_checkout_sessions where payment_attempt_id=$1`,'missing session']]){
 const f=await fixture();const id=message==='amount mismatch'||message==='cancelled'?f.r:message==='expired checkout'?f.p:message==='missing session'?f.a:f.b;await q(sql,[id]);await assert.rejects(()=>settle(f));check((await q('select count(*)::int n from escrow_holds where registration_id=$1',[f.r]))[0].n===0,`${message} rejected without escrow`);
}
const f=await fixture();await assert.rejects(()=>settle({...f,ref:'wrong'}));check(true,'wrong reference rejected');
const other=crypto.randomUUID();await q(`insert into profiles values($1,'umkm','active')`,[other]);
await assert.rejects(()=>q(`select simulate_demo_payment_paid($1,$2,$3,$4,$5)`,[f.r,other,f.b,f.ref,crypto.randomUUID()]));check(true,'another UMKM cannot settle the order');
await q(`update profiles set status='suspended' where id=$1`,[user]);await assert.rejects(()=>settle(f));await q(`update profiles set status='active' where id=$1`,[user]);check(true,'database rechecks suspended account');
const old=await fixture(true);await q(`update payments set qr_code_expires_at=now() where id=$1`,[old.p]);await assert.rejects(()=>settle(old));check(true,'expired legacy QR rejected');
const superseded=await fixture();await q(`insert into payment_attempts(id,payment_id,provider_order_id,status,created_at) values(gen_random_uuid(),$1,'newer','creating',now()+interval '1 minute')`,[superseded.p]);await assert.rejects(()=>settle(superseded));check(true,'superseded checkout rejected');
const core=await fixture();await q(`update payment_attempts set integration_type='core_qris' where id=$1`,[core.a]);await assert.rejects(()=>settle(core));check(true,'core QRIS attempt needs a persisted QR');await q(`update payment_attempts set qr_code_url='https://fixture/qr' where id=$1`,[core.a]);await settle(core);check((await q('select status from registrations where id=$1',[core.r]))[0].status==='paid','persisted Core QRIS checkout can settle');
const replay=await fixture();await Promise.all([settle(replay),settle(replay)]);
check((await q('select count(*)::int n from escrow_holds where registration_id=$1',[replay.r]))[0].n===1,'serialized concurrent submissions retain one escrow');
await q(`select apply_midtrans_payment_event($1,'pending',null,null,null,'{}')`,[replay.a]);
check((await q('select status from registrations where id=$1',[replay.r]))[0].status==='paid','late pending event cannot downgrade settlement');
const rollback=await fixture();
await db.exec(`create function reject_demo_notification() returns trigger language plpgsql as $$begin raise exception 'fixture notification failure';end$$;create trigger fail_notification before insert on notifications for each row execute function reject_demo_notification();`);
await assert.rejects(()=>settle(rollback));
check((await q('select status from payments where id=$1',[rollback.p]))[0].status==='pending','notification failure rolls back payment');
check((await q('select count(*)::int n from escrow_holds where registration_id=$1',[rollback.r]))[0].n===0,'notification failure rolls back escrow');
await db.exec('drop trigger fail_notification on notifications');
await db.exec('set role authenticated');await assert.rejects(()=>settle(f));await db.exec('reset role');check(true,'authenticated cannot call demo RPC');
console.log(`${checks} SQL checks passed`);
if(process.argv.includes('--serve')){const {servePaymentDemo}=await import('../helpers/payment-demo-fixture.mjs');await servePaymentDemo({db,fixture,user,settle});}
}finally{await db.close();}
