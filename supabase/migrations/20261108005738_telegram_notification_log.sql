create table if not exists public.telegram_notifications (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null check (status in ('sent','failed','sending')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.telegram_notifications enable row level security;
create policy "admins manage telegram notifications" on public.telegram_notifications for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.claim_telegram_retry(p_order_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_attempt integer;
begin
  update public.telegram_notifications
  set status='sending', attempts=attempts+1, updated_at=now()
  where order_id=p_order_id and status='failed'
  returning attempts into v_attempt;
  if not found then raise exception 'NOT_RETRYABLE'; end if;
  return v_attempt;
end $$;
revoke all on function public.claim_telegram_retry(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_retry(uuid) to service_role;
