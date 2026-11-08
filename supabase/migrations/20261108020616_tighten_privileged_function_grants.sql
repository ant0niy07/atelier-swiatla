-- Forward-only grant hardening. This intentionally does not revoke is_admin():
-- it is a tiny auth.uid()-scoped boolean helper used by existing RLS policies,
-- and changing its grants without a live policy inventory could break public
-- catalog reads. The helper contains no mutable input or sensitive data.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_record_manual_payment', 'rls_auto_enable')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

-- The checkout package is server/service-role only. Reassert exact grants so
-- a default PUBLIC EXECUTE grant can never be inherited by a replacement.
revoke all on function public.create_checkout_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb) to service_role;
revoke all on function public.claim_telegram_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_notification(uuid) to service_role;
revoke all on function public.claim_telegram_retry(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_retry(uuid) to service_role;
revoke all on function public.transition_order_fulfillment(uuid, public.fulfillment_status, public.manual_payment_status, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_order_fulfillment(uuid, public.fulfillment_status, public.manual_payment_status, text, text, text) to service_role;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;
