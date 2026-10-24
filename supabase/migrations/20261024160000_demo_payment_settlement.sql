begin;
-- Preserve provider behavior while making simulated events explicitly auditable.
do $$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('apply_midtrans_payment_event','finalize_payment')
 loop
   definition:=pg_get_functiondef(f.oid);
   if position('payment_reconciliation' in definition)=0 then raise exception 'payment audit migration required'; end if;
   definition:=replace(definition,'''payment_webhook'',''payment_reconciliation''','''payment_webhook'',''payment_reconciliation'',''payment_demo_simulation''');
   definition:=replace(definition,'''webhook'', p_payload','case when current_setting(''app.operation'',true)=''payment_demo_simulation'' then ''manual'' else ''webhook'' end, p_payload');
   execute definition;
 end loop;
end $$;

-- Keep transaction logs append-only, including the authenticated demo actor at insertion.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.record_transaction_log(uuid,uuid,uuid,text,text,text,text,text,text,jsonb)'::regprocedure) into definition;
 if position('p_payload, p_source, auth.uid()' in definition)=0 then raise exception 'transaction log actor contract changed'; end if;
 definition:=replace(definition,'p_payload, p_source, auth.uid()',
   'p_payload, p_source, case when p_source=''manual'' and p_payload->>''source''=''payment_demo_simulation'' then (p_payload->>''actorId'')::uuid else auth.uid() end');
 execute definition;
end $$;

create function public.simulate_demo_payment_paid(
 p_registration_id uuid, p_actor_id uuid, p_batch_id uuid,
 p_checkout_reference text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 a public.payment_attempts%rowtype; p public.payments%rowtype;
 r public.registrations%rowtype; b public.batches%rowtype; t public.batch_timeline%rowtype;
 payload jsonb; result jsonb; tx text; opens timestamptz; closes timestamptz;
begin
 -- Only the service-role route can invoke this function; user identity is supplied by verified auth.
 if current_user <> session_user and current_setting('role',true) not in ('service_role','none') then
   raise exception 'service role required' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=p_actor_id and role='umkm' and status='active') then
   raise exception 'active UMKM required' using errcode='42501';
 end if;
 select pa.* into a from public.payment_attempts pa join public.payments pm on pm.id=pa.payment_id
   where pm.registration_id=p_registration_id and pa.provider_order_id=p_checkout_reference for update of pa;
 select * into p from public.payments where registration_id=p_registration_id for update;
 select * into r from public.registrations where id=p_registration_id for update;
 if r.id is null or p.id is null or r.umkm_id<>p_actor_id or r.batch_id<>p_batch_id then
   raise exception 'order not found' using errcode='P0002';
 end if;
 select * into b from public.batches where id=r.batch_id for share;
 select * into t from public.batch_timeline where batch_id=r.batch_id for share;
 tx:='DEMO:'||p.id::text;
 if a.id is null and p.midtrans_order_id is distinct from p_checkout_reference then
   raise exception 'checkout mismatch' using errcode='22023';
 end if;
 if p.status='paid' and r.status in ('paid','picked_up','completed') then
   return jsonb_build_object('duplicate',true);
 end if;
 opens:=coalesce(t.effective_payment_opens_at,t.payment_opens_at);
 closes:=coalesce(t.effective_payment_closes_at,t.payment_closes_at);
 if r.status<>'pending_payment' or p.status<>'pending' or b.status not in ('published','closed') then
   raise exception 'order not eligible' using errcode='22023';
 end if;
 if opens is null or closes is null or clock_timestamp()<opens or clock_timestamp()>=closes then
   raise exception 'payment window closed' using errcode='22023';
 end if;
 if r.final_amount is null or r.final_amount<=0 or r.locked_tier_number is null or p.gross_amount is distinct from r.final_amount then
   raise exception 'invoice mismatch' using errcode='22023';
 end if;
 if a.id is not null then
   if a.status<>'pending' or coalesce(a.provider_status,'pending') not in ('pending','not_created') or a.expires_at is null or a.expires_at<=clock_timestamp()
      or exists(select 1 from public.payment_attempts newer where newer.payment_id=p.id and newer.id<>a.id and
        (newer.status='paid' or (newer.status in ('pending','creating') and newer.created_at>a.created_at))) then
     raise exception 'checkout not eligible' using errcode='22023';
   end if;
   if a.integration_type='snap' and not exists(select 1 from public.payment_checkout_sessions
       where payment_attempt_id=a.id and cancelled_at is null and expires_at>clock_timestamp()
         and length(snap_token)>0 and length(redirect_url)>0) then
     raise exception 'checkout session required' using errcode='22023';
   end if;
   if a.integration_type='core_qris' and nullif(trim(a.qr_code_url),'') is null then
     raise exception 'checkout QR required' using errcode='22023';
   end if;
 else
   if exists(select 1 from public.payment_attempts where payment_id=p.id) or p.midtrans_order_id is distinct from p_checkout_reference
      or p.qr_code_url is null or p.qr_code_expires_at is null or p.qr_code_expires_at<=clock_timestamp() then
     raise exception 'checkout required' using errcode='22023';
   end if;
 end if;
 payload:=jsonb_build_object('simulated',true,'source','payment_demo_simulation','actorId',p_actor_id,
   'requestId',p_request_id,'checkoutReference',p_checkout_reference,
   '_wesup_audit',jsonb_build_object('source','payment_demo_simulation','requestId',p_request_id));
 if a.id is not null then
   result:=public.apply_midtrans_payment_event(a.id,'settlement',tx,a.payment_type,'accept',payload);
 else
   perform public.finalize_payment(r.id,tx,payload);
   perform public.record_transaction_log(r.id,p.id,null,'payment_status_change',p.status::text,'paid','settlement',tx,'manual',payload-'_wesup_audit');
   insert into public.notifications(user_id,type,title,message,data) values(r.umkm_id,'payment_success','Pembayaran demo berhasil',
     'Pelunasan sandbox tercatat. Pesanan menunggu persiapan Supplier.',jsonb_build_object('registration_id',r.id,'simulated',true));
 end if;
 return jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.simulate_demo_payment_paid(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.simulate_demo_payment_paid(uuid,uuid,uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
