-- Owner-confirmed recipient for manual BLIK phone transfers. Runtime checkout
-- reads this setting from the database; it is never embedded in client code.
insert into public.store_settings(key, value)
values ('store_operations', jsonb_build_object(
  'accepting_orders', true,
  'blik_phone', '+48 731 542 410'
))
on conflict (key) do update
set value = jsonb_build_object(
  'accepting_orders', coalesce(public.store_settings.value->'accepting_orders', 'true'::jsonb),
  'blik_phone', coalesce(public.store_settings.value->'blik_phone', to_jsonb('+48 731 542 410'::text))
) || public.store_settings.value,
updated_at = now();
