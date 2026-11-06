-- Manual-payment and fulfillment model. No BLIK authorization codes or card data are stored.
create type public.fulfillment_status as enum ('new','awaiting_payment','paid','processing','shipped','delivered','cancelled');
create type public.manual_payment_status as enum ('awaiting_payment','cod_pending','paid','carrier_collected','settled','cancelled');
create type public.delivery_kind as enum ('inpost_locker','courier','courier_cod','inpost_locker_cod');

alter table public.orders
  add column if not exists fulfillment_status public.fulfillment_status not null default 'new',
  add column if not exists manual_payment_status public.manual_payment_status not null default 'awaiting_payment',
  add column if not exists delivery_kind public.delivery_kind,
  add column if not exists locker_code text,
  add column if not exists customer_note text not null default '',
  add column if not exists carrier_name text,
  add column if not exists tracking_number text,
  add column if not exists paid_at timestamptz,
  add column if not exists carrier_collected_at timestamptz,
  add column if not exists settled_at timestamptz;

create table if not exists public.delivery_methods (
  id uuid primary key default gen_random_uuid(),
  kind public.delivery_kind not null unique,
  label text not null,
  active boolean not null default false,
  supports_blik_before_dispatch boolean not null default false,
  supports_cod boolean not null default false,
  rate_grosz integer check(rate_grosz is null or rate_grosz >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind in ('courier_cod','inpost_locker_cod')) = supports_cod)
);

alter table public.delivery_methods enable row level security;
create policy "public reads active delivery methods" on public.delivery_methods for select using(active);
create policy "admins manage delivery methods" on public.delivery_methods for all using(public.is_admin()) with check(public.is_admin());
create trigger delivery_methods_touch before update on public.delivery_methods for each row execute procedure public.touch_updated_at();

-- Administrators update these fields only after independently verifying payment or carrier settlement.
create or replace function public.admin_record_manual_payment(
  p_order uuid, p_status public.manual_payment_status, p_note text default ''
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.orders set
    manual_payment_status=p_status,
    fulfillment_status=case when p_status='paid' then 'paid' when p_status='settled' then fulfillment_status else fulfillment_status end,
    paid_at=case when p_status='paid' then now() else paid_at end,
    carrier_collected_at=case when p_status='carrier_collected' then now() else carrier_collected_at end,
    settled_at=case when p_status='settled' then now() else settled_at end
  where id=p_order;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
end $$;
