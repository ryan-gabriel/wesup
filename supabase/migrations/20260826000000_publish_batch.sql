-- Wesup migration 0015: supplier batch publishing
-- Covers the missing draft -> published transition: suppliers could create
-- batches but nothing could ever make them visible in the marketplace.
--
-- Design notes:
--   * Mirrors cancel_batch(): ownership + allowed source state enforced in a
--     SECURITY DEFINER function; thin API route just calls the RPC.
--   * Refuses to publish stale drafts whose registration window already
--     started/passed (API Gatekeeper: validate absolute timestamps).
--   * Timeline linear order is already guaranteed by the batch_timeline
--     CHECK constraint and the creation-time validator.

create or replace function public.publish_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opens timestamptz;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;

  select t.registration_opens_at into v_opens
    from public.batch_timeline t
   where t.batch_id = p_batch_id;
  if v_opens is null then
    raise exception 'batch has no timeline';
  end if;
  if v_opens <= now() then
    raise exception 'registration window already started';
  end if;

  update public.batches
     set status = 'published',
         updated_at = now()
   where id = p_batch_id
     and supplier_id = auth.uid()
     and status = 'draft';
  if not found then
    raise exception 'batch not found or not publishable';
  end if;
end;
$$;
