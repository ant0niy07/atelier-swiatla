-- Live category taxonomy and the non-standalone scent-personalisation add-on.
-- All operations are idempotent and retain existing products/orders.
insert into public.categories (slug, name, active)
values
  ('swiece-formowe', 'Świece formowe', true),
  ('swiece-w-szkle', 'Świece w szkle', true),
  ('swiece-zelowe', 'Świece żelowe', true)
on conflict (slug) do update set name = excluded.name, active = true;

update public.products p set category_id = c.id
from public.categories c
where c.slug = 'swiece-formowe'
  and p.sku in ('XMAS-TREE-001', 'XMAS-GINGER-001');

update public.products p set category_id = c.id
from public.categories c
where c.slug = 'swiece-w-szkle'
  and p.sku in ('XMAS-AMBER-180', 'XMAS-MINI-120');

alter table public.products
  add column if not exists is_personalization_addon boolean not null default false;

alter table public.order_items
  add column if not exists customization jsonb;

insert into public.products (slug, sku, name, description, price_grosz, stock_on_hand, made_to_order, status, is_personalization_addon)
values (
  'personalizacja-zapachu',
  'PERS-ZAPACH-001',
  'Personalizacja zapachu świecy',
  'Usługa personalizacji zapachu, dostępna wyłącznie jako dodatek do jednej świecy.',
  3990,
  0,
  true,
  'draft',
  true
)
on conflict (sku) do update set
  is_personalization_addon = true,
  price_grosz = excluded.price_grosz,
  made_to_order = true;
