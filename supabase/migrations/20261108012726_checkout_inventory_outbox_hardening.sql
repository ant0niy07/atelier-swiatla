-- Forward-only hardening for the pending checkout package.  This migration is
-- intentionally additive: it is designed to run after 03004, 05000 and 05738
-- on an existing store and never replays the historical baseline.

alter table public.order_items
  add column if not exists inventory_state text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_inventory_state_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items add constraint order_items_inventory_state_check
      check (inventory_state in ('none', 'reserved', 'consumed', 'released'));
  end if;
end $$;

-- The first checkout request must leave durable notification intent in the
-- same transaction as the order.  A later server failure can then be retried.
alter table public.telegram_notifications
  drop constraint if exists telegram_notifications_status_check;
alter table public.telegram_notifications
  add constraint telegram_notifications_status_check
  check (status in ('pending', 'sending', 'sent', 'failed'));

create or replace function public.claim_telegram_notification(p_order_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_attempt integer;
begin
  update public.telegram_notifications
  set status = 'sending', attempts = attempts + 1, updated_at = now()
  where order_id = p_order_id
    and (
      status in ('pending', 'failed')
      or (status = 'sending' and updated_at < now() - interval '10 minutes')
    )
  returning attempts into v_attempt;

  if not found then
    raise exception 'NOT_RETRYABLE';
  end if;
  return v_attempt;
end $$;

revoke all on function public.claim_telegram_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_notification(uuid) to service_role;

-- Keep the old retry name for deployed API code, but route it through the
-- lease-aware claim implementation.
create or replace function public.claim_telegram_retry(p_order_id uuid)
returns integer language sql security definer set search_path=public as $$
  select public.claim_telegram_notification(p_order_id)
$$;
revoke all on function public.claim_telegram_retry(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_retry(uuid) to service_role;

create or replace function public.create_checkout_order(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_key uuid;
  v_hash text;
  v_existing_hash text;
  v_existing_order_id uuid;
  v_order public.orders;
  v_customer uuid;
  v_delivery public.delivery_methods;
  v_promo public.promotions;
  v_product public.products;
  v_item jsonb;
  v_qty integer;
  v_skus text[];
  v_subtotal bigint := 0;
  v_eligible bigint := 0;
  v_discount bigint := 0;
  v_shipping bigint := 0;
  v_total bigint := 0;
  v_code text;
  v_payment text;
  v_note text;
  v_locker text;
  v_accepting_orders boolean := true;
  v_blik_phone text;
  v_email text;
begin
  if jsonb_typeof(p_request) <> 'object' then raise exception 'INVALID_ORDER'; end if;
  begin
    v_key := (p_request->>'idempotencyKey')::uuid;
  exception when others then
    raise exception 'IDEMPOTENCY_INVALID';
  end;
  v_hash := nullif(trim(coalesce(p_request->>'requestHash', '')), '');
  if v_hash is null or v_hash !~ '^[a-f0-9]{64}$' then raise exception 'IDEMPOTENCY_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext(v_key::text));

  select i.request_hash, i.order_id into v_existing_hash, v_existing_order_id
  from public.checkout_idempotency i
  where i.idempotency_key = v_key;
  if found then
    if v_existing_hash <> v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if v_existing_order_id is null then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    select * into v_order from public.orders where id = v_existing_order_id;
    if not found then raise exception 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return jsonb_build_object(
      'orderId', v_order.id, 'orderNumber', v_order.order_number,
      'totalGrosz', v_order.total_grosz, 'paymentMethod', v_order.payment_method,
      'paymentStatus', v_order.manual_payment_status, 'repeated', true
    );
  end if;

  if jsonb_typeof(p_request->'customer') <> 'object'
    or jsonb_typeof(p_request->'items') <> 'array'
    or jsonb_array_length(p_request->'items') not between 1 and 20 then
    raise exception 'INVALID_ORDER';
  end if;
  v_email := lower(trim(coalesce(p_request#>>'{customer,email}', '')));
  if length(trim(coalesce(p_request#>>'{customer,firstName}', ''))) = 0
    or length(trim(coalesce(p_request#>>'{customer,lastName}', ''))) = 0
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(trim(coalesce(p_request#>>'{customer,phone}', ''))) < 7
    or length(trim(coalesce(p_request#>>'{customer,street}', ''))) < 3
    or length(trim(coalesce(p_request#>>'{customer,postalCode}', ''))) < 4
    or length(trim(coalesce(p_request#>>'{customer,city}', ''))) < 2 then
    raise exception 'CUSTOMER_INVALID';
  end if;

  v_payment := p_request->>'paymentMethod';
  if v_payment not in ('blik_before_dispatch', 'cod', 'pay_on_local_delivery') then
    raise exception 'PAYMENT_INVALID';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_request->'items') item
    where nullif(trim(item->>'sku'), '') is null
       or nullif(item->>'variantId', '') is not null
       or (item->>'quantity') !~ '^[0-9]+$'
       or (item->>'quantity')::integer not between 1 and 20
  ) then raise exception 'ITEMS_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_request->'items') item group by item->>'sku' having count(*) > 1) then
    raise exception 'DUPLICATE_SKU';
  end if;

  insert into public.checkout_idempotency(idempotency_key, request_hash) values(v_key, v_hash);
  select coalesce((value->>'accepting_orders')::boolean, true), nullif(trim(value->>'blik_phone'), '')
    into v_accepting_orders, v_blik_phone
  from public.store_settings where key = 'store_operations';
  if not coalesce(v_accepting_orders, true) then raise exception 'ORDERS_NOT_ACCEPTED'; end if;
  if v_payment = 'blik_before_dispatch' and v_blik_phone is null then raise exception 'BLIK_NOT_CONFIGURED'; end if;

  select * into v_delivery from public.delivery_methods
  where id = (p_request->>'deliveryMethodId')::uuid and active = true for update;
  if not found or v_delivery.rate_grosz is null then raise exception 'DELIVERY_INVALID'; end if;
  if (v_payment = 'cod' and not v_delivery.supports_cod)
    or (v_payment = 'blik_before_dispatch' and not v_delivery.supports_blik_before_dispatch)
    or (v_payment = 'pay_on_local_delivery' and v_delivery.kind <> 'local_warsaw') then
    raise exception 'PAYMENT_INVALID';
  end if;
  v_locker := nullif(upper(trim(coalesce(p_request->>'lockerCode', ''))), '');
  if v_delivery.kind in ('inpost_locker', 'inpost_locker_cod') and (v_locker is null or v_locker !~ '^[A-Z0-9][A-Z0-9_-]{2,39}$') then
    raise exception 'LOCKER_INVALID';
  end if;

  -- Lock physical products in deterministic SKU order. This avoids a
  -- multi-product cart deadlock and makes stock reservation atomic.
  for v_item in select value from jsonb_array_elements(p_request->'items') order by value->>'sku' loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products
    where sku = v_item->>'sku' and status = 'published' for update;
    if not found or coalesce(v_product.is_personalization_addon, false) then raise exception 'PRODUCT_INVALID'; end if;
    if not v_product.made_to_order and v_product.stock_on_hand - v_product.stock_reserved < v_qty then
      raise exception 'STOCK_INVALID';
    end if;
    v_subtotal := v_subtotal + v_product.price_grosz::bigint * v_qty;
  end loop;
  if v_subtotal <= 0 or v_subtotal > 100000000 then raise exception 'TOTAL_INVALID'; end if;
  if v_delivery.minimum_order_grosz is not null and v_subtotal < v_delivery.minimum_order_grosz then
    raise exception 'DELIVERY_MINIMUM_NOT_MET';
  end if;

  v_shipping := v_delivery.rate_grosz;
  v_code := nullif(upper(trim(coalesce(p_request->>'promoCode', ''))), '');
  if v_code is not null then
    select * into v_promo from public.promotions
    where code = v_code and active = true and archived_at is null
      and starts_at <= now() and (ends_at is null or ends_at > now())
    for update;
    if not found then raise exception 'PROMOTION_INVALID'; end if;
    if (v_promo.usage_limit is not null and v_promo.used_count >= v_promo.usage_limit)
       or v_subtotal < v_promo.min_order_grosz then raise exception 'PROMOTION_INVALID'; end if;
    select coalesce(sum(p.price_grosz::bigint * (item.value->>'quantity')::integer), 0) into v_eligible
    from jsonb_array_elements(p_request->'items') item
    join public.products p on p.sku = item.value->>'sku'
    where (not exists(select 1 from public.promotion_product_rules r where r.promotion_id = v_promo.id and r.excluded = false)
           or exists(select 1 from public.promotion_product_rules r where r.promotion_id = v_promo.id and r.product_id = p.id and r.excluded = false))
      and (not exists(select 1 from public.promotion_category_rules r where r.promotion_id = v_promo.id)
           or exists(select 1 from public.promotion_category_rules r where r.promotion_id = v_promo.id and r.category_id = p.category_id))
      and not exists(select 1 from public.promotion_product_rules r where r.promotion_id = v_promo.id and r.product_id = p.id and r.excluded = true);
    if v_eligible <= 0 then raise exception 'PROMOTION_INELIGIBLE'; end if;
    if v_promo.kind = 'percentage' then
      v_discount := floor(v_eligible * v_promo.value / 100.0)::bigint;
    elsif v_promo.kind = 'fixed' then
      v_discount := v_promo.value;
    elsif v_promo.kind = 'free_shipping' then
      v_shipping := 0;
    else raise exception 'PROMOTION_INVALID';
    end if;
    v_discount := least(v_eligible, v_discount, coalesce(v_promo.max_discount_grosz::bigint, v_discount));
    update public.promotions set used_count = used_count + 1 where id = v_promo.id;
  end if;
  v_total := v_subtotal - v_discount + v_shipping;
  if v_total < 0 or v_total > 100000000 then raise exception 'TOTAL_INVALID'; end if;

  insert into public.customers(email, first_name, last_name, phone)
  values(v_email, trim(p_request#>>'{customer,firstName}'), trim(p_request#>>'{customer,lastName}'), trim(p_request#>>'{customer,phone}'))
  on conflict(email) do update set first_name = excluded.first_name, last_name = excluded.last_name, phone = excluded.phone
  returning id into v_customer;
  v_note := left(trim(coalesce(p_request->>'note', '')), 1000);
  insert into public.orders(customer_id, email, status, payment_status, manual_payment_status, fulfillment_status,
    payment_method, shipping_method, delivery_kind, locker_code, shipping_grosz, subtotal_grosz, discount_grosz,
    total_grosz, promotion_code, address, customer_note, is_test, reservation_expires_at)
  values(v_customer, v_email, 'pending_payment', 'awaiting',
    case when v_payment in ('cod','pay_on_local_delivery') then 'cod_pending' else 'awaiting_payment' end,
    case when v_payment = 'blik_before_dispatch' then 'awaiting_payment' else 'new' end,
    v_payment, v_delivery.label, v_delivery.kind, v_locker, v_shipping::integer, v_subtotal::integer,
    v_discount::integer, v_total::integer, v_code, p_request->'customer', v_note, false,
    case when v_payment = 'blik_before_dispatch' then now() + interval '48 hours' else null end)
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_request->'items') order by value->>'sku' loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where sku = v_item->>'sku';
    insert into public.order_items(order_id, product_id, sku, product_name, unit_price_grosz, quantity, line_total_grosz, inventory_state)
    values(v_order.id, v_product.id, v_product.sku, v_product.name, v_product.price_grosz, v_qty,
      v_product.price_grosz * v_qty, case when v_product.made_to_order then 'none' else 'reserved' end);
    if not v_product.made_to_order then
      update public.products set stock_reserved = stock_reserved + v_qty where id = v_product.id;
    end if;
  end loop;
  if v_code is not null then
    insert into public.promotion_redemptions(promotion_id, order_id, customer_id, discount_grosz, status)
    values(v_promo.id, v_order.id, v_customer, v_discount::integer, 'reserved');
  end if;
  insert into public.order_status_history(order_id, status, note)
  values(v_order.id, v_order.status, 'CHECKOUT_CREATED');
  insert into public.telegram_notifications(order_id, status, attempts)
  values(v_order.id, 'pending', 0) on conflict(order_id) do nothing;
  update public.checkout_idempotency set order_id = v_order.id where idempotency_key = v_key;
  return jsonb_build_object(
    'orderId', v_order.id, 'orderNumber', v_order.order_number, 'totalGrosz', v_order.total_grosz,
    'paymentMethod', v_order.payment_method, 'paymentStatus', v_order.manual_payment_status, 'repeated', false
  );
end $$;

revoke all on function public.create_checkout_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb) to service_role;

-- Service-role-only stock transition used by the protected admin API.  Item
-- state makes cancellation and shipment idempotent instead of double moving
-- inventory on repeated clicks.
create or replace function public.transition_order_fulfillment(
  p_order_id uuid, p_next public.fulfillment_status, p_manual public.manual_payment_status,
  p_carrier text default null, p_tracking text default null, p_note text default ''
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_order public.orders;
  v_item record;
  v_next public.fulfillment_status := p_next;
  v_manual public.manual_payment_status := p_manual;
  v_order_status public.order_status;
  v_payment_status public.payment_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  -- Explicit manual confirmation may advance an awaiting order to paid, but
  -- no other payment state is inferred from a fulfillment click.
  if v_manual = 'paid' and v_next in ('new', 'awaiting_payment') then v_next := 'paid'; end if;
  if v_next = 'cancelled' and v_manual in ('awaiting_payment', 'cod_pending') then v_manual := 'cancelled'; end if;
  if v_next <> v_order.fulfillment_status and not (
    (v_order.fulfillment_status = 'new' and v_next in ('awaiting_payment','paid','processing','cancelled')) or
    (v_order.fulfillment_status = 'awaiting_payment' and v_next in ('paid','cancelled')) or
    (v_order.fulfillment_status = 'paid' and v_next in ('processing','cancelled')) or
    (v_order.fulfillment_status = 'processing' and v_next in ('shipped','cancelled')) or
    (v_order.fulfillment_status = 'shipped' and v_next = 'delivered') or
    (v_next = v_order.fulfillment_status)
  ) then raise exception 'FULFILLMENT_TRANSITION_INVALID'; end if;
  if v_next in ('paid', 'processing', 'shipped', 'delivered')
    and v_order.payment_method = 'blik_before_dispatch' and v_manual not in ('paid', 'settled') then
    raise exception 'PAYMENT_NOT_CONFIRMED';
  end if;
  if v_next = 'cancelled' and v_manual not in ('cancelled', 'paid', 'settled', 'carrier_collected') then
    raise exception 'PAYMENT_TRANSITION_INVALID';
  end if;

  if v_next = 'cancelled' and v_order.fulfillment_status <> 'cancelled' then
    for v_item in select oi.*, p.made_to_order from public.order_items oi join public.products p on p.id = oi.product_id
      where oi.order_id = p_order_id and oi.inventory_state = 'reserved' order by oi.sku for update of oi, p loop
      update public.products set stock_reserved = greatest(0, stock_reserved - v_item.quantity) where id = v_item.product_id;
      update public.order_items set inventory_state = 'released' where id = v_item.id;
    end loop;
    with released as (
      update public.promotion_redemptions set status = 'released', released_at = now()
      where order_id = p_order_id and status = 'reserved' returning promotion_id
    ), counts as (select promotion_id, count(*) as count from released group by promotion_id)
    update public.promotions p set used_count = greatest(0, p.used_count - counts.count) from counts where p.id = counts.promotion_id;
  elsif v_next = 'shipped' and v_order.fulfillment_status <> 'shipped' then
    for v_item in select oi.* from public.order_items oi where oi.order_id = p_order_id and oi.inventory_state = 'reserved' order by oi.sku for update loop
      update public.products set stock_reserved = stock_reserved - v_item.quantity, stock_on_hand = stock_on_hand - v_item.quantity
      where id = v_item.product_id and stock_reserved >= v_item.quantity and stock_on_hand >= v_item.quantity;
      if not found then raise exception 'STOCK_TRANSITION_INVALID'; end if;
      update public.order_items set inventory_state = 'consumed' where id = v_item.id;
    end loop;
  end if;
  v_order_status := case v_next
    when 'new' then 'pending_payment'::public.order_status
    when 'awaiting_payment' then 'pending_payment'::public.order_status
    when 'paid' then 'paid'::public.order_status
    when 'processing' then 'processing'::public.order_status
    when 'shipped' then 'shipped'::public.order_status
    when 'delivered' then 'shipped'::public.order_status
    when 'cancelled' then 'cancelled'::public.order_status
  end;
  v_payment_status := case
    when v_manual in ('paid', 'carrier_collected', 'settled') then 'confirmed'::public.payment_status
    when v_manual = 'cancelled' then 'failed'::public.payment_status
    else 'awaiting'::public.payment_status
  end;
  update public.orders set status = v_order_status, payment_status = v_payment_status,
    fulfillment_status = v_next, manual_payment_status = v_manual,
    carrier_name = p_carrier, tracking_number = p_tracking,
    paid_at = case when v_manual = 'paid' and paid_at is null then now() else paid_at end
  where id = p_order_id;
  insert into public.order_status_history(order_id, status, note) values(p_order_id, v_order_status, left(coalesce(p_note,''), 2000));
end $$;
revoke all on function public.transition_order_fulfillment(uuid, public.fulfillment_status, public.manual_payment_status, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_order_fulfillment(uuid, public.fulfillment_status, public.manual_payment_status, text, text, text) to service_role;

-- Database-backed fixed windows work across Vercel function instances. The
-- route stores only a SHA-256 subject digest, never a raw IP address.
create table if not exists public.api_rate_limit_buckets (
  scope text not null check (scope ~ '^[a-z0-9_-]{1,50}$'),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  bucket_started_at timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (scope, subject_hash, bucket_started_at)
);
alter table public.api_rate_limit_buckets enable row level security;

create or replace function public.consume_api_rate_limit(
  p_scope text, p_subject_hash text, p_limit integer, p_window_seconds integer
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_bucket timestamptz; v_hits integer;
begin
  if p_limit not between 1 and 1000 or p_window_seconds not between 1 and 86400
    or p_scope !~ '^[a-z0-9_-]{1,50}$' or p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'RATE_LIMIT_INVALID';
  end if;
  v_bucket := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into public.api_rate_limit_buckets(scope, subject_hash, bucket_started_at, hits)
  values(p_scope, p_subject_hash, v_bucket, 1)
  on conflict(scope, subject_hash, bucket_started_at) do update
    set hits = public.api_rate_limit_buckets.hits + 1
    where public.api_rate_limit_buckets.hits < p_limit
  returning hits into v_hits;
  return found;
end $$;
revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;
