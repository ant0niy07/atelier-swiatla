-- Made-to-order candles may legitimately have zero physical stock.
alter table public.products add column if not exists made_to_order boolean not null default false;

-- Local owner delivery is neither carrier COD nor a carrier settlement.
alter type public.delivery_kind add value if not exists 'local_warsaw';
alter table public.delivery_methods
  add column if not exists service_area text,
  add column if not exists available_days text,
  add column if not exists description text,
  add column if not exists minimum_order_grosz integer check(minimum_order_grosz is null or minimum_order_grosz >= 0);

-- The owner must explicitly enable it and deliberately set its rate (for example 1000 grosz).
-- No delivery methods are seeded here, so the storefront never invents a commercial price.
