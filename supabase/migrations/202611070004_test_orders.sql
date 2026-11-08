alter table public.orders add column if not exists is_test boolean not null default false;
alter table public.orders add column if not exists hidden_at timestamptz;
create index if not exists orders_active_created_idx on public.orders(created_at desc) where is_test=false;
create index if not exists orders_test_created_idx on public.orders(created_at desc) where is_test=true;
