create table if not exists public.telegram_notifications (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null check (status in ('sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.telegram_notifications enable row level security;
create policy "admins manage telegram notifications" on public.telegram_notifications for all using (public.is_admin()) with check (public.is_admin());
