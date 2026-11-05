-- ATELIER ŚWIATŁA: initial production schema. Apply once to the empty project.
create extension if not exists pgcrypto;

create type public.product_status as enum ('draft','published','archived');
create type public.order_status as enum ('pending_payment','paid','processing','shipped','cancelled','refunded');
create type public.payment_status as enum ('awaiting','confirmed','failed','refunded');
create type public.promotion_type as enum ('percentage','fixed','free_shipping');

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(), slug text not null unique, sku text not null unique,
  name text not null, description text not null default '', price_grosz integer not null check(price_grosz >= 0),
  stock_on_hand integer not null default 0 check(stock_on_hand >= 0), stock_reserved integer not null default 0 check(stock_reserved >= 0 and stock_reserved <= stock_on_hand),
  category_id uuid references public.categories(id), fragrance text, status public.product_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_images (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique, alt_text text not null default '', position smallint not null default 0,
  created_at timestamptz not null default now()
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique, first_name text, last_name text, phone text, created_at timestamptz not null default now()
);
create table public.promotions (
  id uuid primary key default gen_random_uuid(), code text not null unique check(code=upper(code) and code ~ '^[A-Z0-9-]{3,40}$'),
  kind public.promotion_type not null, value integer not null check(value>0), min_order_grosz integer not null default 0 check(min_order_grosz>=0),
  max_discount_grosz integer check(max_discount_grosz is null or max_discount_grosz>=0),
  starts_at timestamptz not null default now(), ends_at timestamptz, usage_limit integer check(usage_limit is null or usage_limit>0),
  used_count integer not null default 0 check(used_count>=0), active boolean not null default false, archived_at timestamptz,
  internal_note text not null default '', created_at timestamptz not null default now(),
  check(ends_at is null or ends_at>starts_at), check((kind='percentage' and value between 1 and 100) or (kind='fixed' and value>0) or (kind='free_shipping' and value=1))
);
create table public.promotion_product_rules (
  promotion_id uuid not null references public.promotions(id) on delete cascade, product_id uuid not null references public.products(id) on delete cascade,
  excluded boolean not null default false, primary key(promotion_id,product_id)
);
create table public.promotion_category_rules (
  promotion_id uuid not null references public.promotions(id) on delete cascade, category_id uuid not null references public.categories(id) on delete cascade,
  primary key(promotion_id,category_id)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
  customer_id uuid references public.customers(id), email text not null, status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'awaiting', payment_method text not null,
  shipping_method text not null, shipping_grosz integer not null check(shipping_grosz>=0),
  subtotal_grosz integer not null check(subtotal_grosz>=0), discount_grosz integer not null default 0 check(discount_grosz>=0),
  total_grosz integer not null check(total_grosz>=0), promotion_code text, reservation_expires_at timestamptz,
  address jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(total_grosz=subtotal_grosz-discount_grosz+shipping_grosz)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id), sku text not null, product_name text not null,
  unit_price_grosz integer not null check(unit_price_grosz>=0), quantity integer not null check(quantity>0), line_total_grosz integer not null check(line_total_grosz>=0),
  unique(order_id,product_id), check(line_total_grosz=unit_price_grosz*quantity)
);
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null, actor_id uuid references auth.users(id), note text not null default '', created_at timestamptz not null default now()
);
create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(), promotion_id uuid not null references public.promotions(id),
  order_id uuid not null unique references public.orders(id) on delete cascade, customer_id uuid references public.customers(id),
  discount_grosz integer not null check(discount_grosz>=0), status text not null check(status in ('reserved','redeemed','released')),
  created_at timestamptz not null default now(), released_at timestamptz
);
create table public.checkout_idempotency (
  idempotency_key uuid primary key, order_id uuid references public.orders(id), request_hash text not null,
  created_at timestamptz not null default now()
);
create table public.store_settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create index promotions_lookup_idx on public.promotions(code,active,starts_at,ends_at);
create index orders_customer_idx on public.orders(customer_id,created_at desc);
create index redemption_promotion_idx on public.promotion_redemptions(promotion_id,status);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid())
$$;
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute procedure public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute procedure public.touch_updated_at();

-- Atomic promotion reservation. The checkout RPC must call this in the same transaction as stock reservation.
create or replace function public.reserve_promotion(p_code text,p_order uuid,p_customer uuid,p_discount integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare p public.promotions; r uuid;
begin
 select * into p from public.promotions where code=upper(trim(p_code)) and active and archived_at is null and starts_at<=now() and (ends_at is null or ends_at>now()) for update;
 if not found then raise exception 'PROMOTION_INVALID'; end if;
 if p.usage_limit is not null and p.used_count>=p.usage_limit then raise exception 'PROMOTION_LIMIT_REACHED'; end if;
 update public.promotions set used_count=used_count+1 where id=p.id;
 insert into public.promotion_redemptions(promotion_id,order_id,customer_id,discount_grosz,status) values(p.id,p_order,p_customer,p_discount,'reserved') returning id into r;
 return r;
end $$;
create or replace function public.release_expired_reservations() returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 with released as (
   update public.promotion_redemptions r set status='released',released_at=now()
   from public.orders o where r.order_id=o.id and r.status='reserved' and o.reservation_expires_at<now()
   returning r.promotion_id
 ), counted as (select promotion_id,count(*) c from released group by promotion_id)
 update public.promotions p set used_count=p.used_count-counted.c from counted where p.id=counted.promotion_id;
 get diagnostics n=row_count; return n;
end $$;

alter table public.admin_users enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security;
alter table public.product_images enable row level security; alter table public.customers enable row level security; alter table public.orders enable row level security;
alter table public.order_items enable row level security; alter table public.order_status_history enable row level security; alter table public.promotions enable row level security;
alter table public.promotion_product_rules enable row level security; alter table public.promotion_category_rules enable row level security; alter table public.promotion_redemptions enable row level security;
alter table public.checkout_idempotency enable row level security; alter table public.store_settings enable row level security;
create policy "public read published catalog" on public.products for select using(status='published');
create policy "public read categories" on public.categories for select using(active);
create policy "public read images" on public.product_images for select using(exists(select 1 from public.products p where p.id=product_id and p.status='published'));
create policy "admins full products" on public.products for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full categories" on public.categories for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full images" on public.product_images for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full promotions" on public.promotions for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full promotion product rules" on public.promotion_product_rules for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full promotion category rules" on public.promotion_category_rules for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full orders" on public.orders for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full items" on public.order_items for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full history" on public.order_status_history for all using(public.is_admin()) with check(public.is_admin());
create policy "admins full settings" on public.store_settings for all using(public.is_admin()) with check(public.is_admin());
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do nothing;
create policy "public read product images" on storage.objects for select using(bucket_id='product-images');
create policy "admins manage product images" on storage.objects for all using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());
