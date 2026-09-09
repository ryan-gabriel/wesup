-- Supplier catalog audit actions.
-- Keep this additive and idempotent because older environments may have
-- received the catalog lifecycle migration before it was consolidated here.
alter type public.audit_action add value if not exists 'create_batch';
alter type public.audit_action add value if not exists 'update_batch';
alter type public.audit_action add value if not exists 'delete_batch';
