-- Called only by the server service role. Any exception rolls back every write.
create or replace function public.create_checkout_order(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_key uuid := (p_request->>'idempotencyKey')::uuid;
  v_hash text := p_request->>'requestHash'; v_existing_hash text; v_existing_order_id uuid; v_order public.orders; v_customer uuid;
  v_delivery public.delivery_methods; v_promo public.promotions; v_item jsonb; v_product public.products;
  v_subtotal integer := 0; v_eligible integer := 0; v_discount integer := 0; v_shipping integer := 0; v_total integer; v_code text := null;
  v_payment text := p_request->>'paymentMethod'; v_note text := coalesce(p_request->>'note','');
begin
  -- Serialise equal idempotency keys before the unique insert. This makes an
  -- identical concurrent retry observe the completed order instead of raising.
  perform pg_advisory_xact_lock(hashtext(v_key::text));
  if jsonb_typeof(p_request->'items')<>'array' or jsonb_array_length(p_request->'items')=0 or jsonb_array_length(p_request->'items')>20 then raise exception 'ITEMS_INVALID'; end if;
  if v_payment not in ('blik_before_dispatch','cod','pay_on_local_delivery') then raise exception 'PAYMENT_INVALID'; end if;
  select i.request_hash, i.order_id into v_existing_hash, v_existing_order_id from public.checkout_idempotency i where i.idempotency_key=v_key;
  if found then
    if v_existing_hash<>v_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    if v_existing_order_id is not null then
      select * into v_order from public.orders where id=v_existing_order_id;
      if found then return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number,'totalGrosz',v_order.total_grosz,'paymentMethod',v_order.payment_method,'paymentStatus',v_order.manual_payment_status,'repeated',true); end if;
    end if;
    raise exception 'IDEMPOTENCY_IN_PROGRESS';
  end if;
  insert into public.checkout_idempotency(idempotency_key,request_hash) values(v_key,v_hash);
  select * into v_delivery from public.delivery_methods where id=(p_request->>'deliveryMethodId')::uuid and active=true for update;
  if not found or v_delivery.rate_grosz is null then raise exception 'DELIVERY_INVALID'; end if;
  if (v_payment='cod' and not v_delivery.supports_cod) or (v_payment='blik_before_dispatch' and not v_delivery.supports_blik_before_dispatch) or (v_payment='pay_on_local_delivery' and v_delivery.kind<>'local_warsaw') then raise exception 'PAYMENT_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(p_request->'items') x group by x->>'sku' having count(*)>1) then raise exception 'DUPLICATE_SKU'; end if;
  for v_item in select * from jsonb_array_elements(p_request->'items') loop
    if coalesce((v_item->>'quantity')::integer,0)<1 or coalesce((v_item->>'quantity')::integer,0)>20 then raise exception 'QUANTITY_INVALID'; end if;
    select * into v_product from public.products where sku=v_item->>'sku' and status='published' for update;
    if not found then raise exception 'PRODUCT_INVALID'; end if;
    if not v_product.made_to_order and v_product.stock_on_hand-v_product.stock_reserved < (v_item->>'quantity')::integer then raise exception 'STOCK_INVALID'; end if;
    v_subtotal:=v_subtotal+v_product.price_grosz*(v_item->>'quantity')::integer;
  end loop;
  v_code:=nullif(upper(trim(p_request->>'promoCode')),'');
  if v_code is not null then
    select * into v_promo from public.promotions where code=v_code and active=true and archived_at is null and starts_at<=now() and (ends_at is null or ends_at>now()) for update;
    if not found or (v_promo.usage_limit is not null and v_promo.used_count>=v_promo.usage_limit) or v_subtotal<v_promo.min_order_grosz then raise exception 'PROMOTION_INVALID'; end if;
    select coalesce(sum(p.price_grosz*(x->>'quantity')::integer),0) into v_eligible from jsonb_array_elements(p_request->'items') x join public.products p on p.sku=x->>'sku' where (not exists(select 1 from public.promotion_product_rules r where r.promotion_id=v_promo.id and r.excluded=false) or exists(select 1 from public.promotion_product_rules r where r.promotion_id=v_promo.id and r.product_id=p.id and r.excluded=false)) and (not exists(select 1 from public.promotion_category_rules r where r.promotion_id=v_promo.id) or exists(select 1 from public.promotion_category_rules r where r.promotion_id=v_promo.id and r.category_id=p.category_id)) and not exists(select 1 from public.promotion_product_rules r where r.promotion_id=v_promo.id and r.product_id=p.id and r.excluded=true);
    if v_eligible=0 then raise exception 'PROMOTION_INELIGIBLE'; end if;
    if v_promo.kind='percentage' then v_discount:=floor(v_eligible*v_promo.value/100.0)::integer; elsif v_promo.kind='fixed' then v_discount:=v_promo.value; else v_shipping:=0; end if;
    v_discount:=least(v_eligible,coalesce(least(v_discount,v_promo.max_discount_grosz),v_discount));
    update public.promotions set used_count=used_count+1 where id=v_promo.id;
  end if;
  if v_shipping=0 and (v_code is null or v_promo.kind<>'free_shipping') then v_shipping:=v_delivery.rate_grosz; end if;
  v_total:=greatest(0,v_subtotal-v_discount+v_shipping);
  insert into public.customers(email,first_name,last_name,phone) values(p_request#>>'{customer,email}',p_request#>>'{customer,firstName}',p_request#>>'{customer,lastName}',p_request#>>'{customer,phone}') on conflict(email) do update set first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone returning id into v_customer;
  insert into public.orders(customer_id,email,status,payment_status,manual_payment_status,fulfillment_status,payment_method,shipping_method,delivery_kind,shipping_grosz,subtotal_grosz,discount_grosz,total_grosz,promotion_code,address,customer_note,is_test) values(v_customer,p_request#>>'{customer,email}','pending_payment','awaiting',case when v_payment in ('cod','pay_on_local_delivery') then 'cod_pending' else 'awaiting_payment' end,case when v_payment='blik_before_dispatch' then 'awaiting_payment' else 'new' end,v_payment,v_delivery.label,v_delivery.kind,v_shipping,v_subtotal,v_discount,v_total,v_code,p_request->'customer',v_note,false) returning * into v_order;
  for v_item in select * from jsonb_array_elements(p_request->'items') loop select * into v_product from public.products where sku=v_item->>'sku'; insert into public.order_items(order_id,product_id,sku,product_name,unit_price_grosz,quantity,line_total_grosz) values(v_order.id,v_product.id,v_product.sku,v_product.name,v_product.price_grosz,(v_item->>'quantity')::integer,v_product.price_grosz*(v_item->>'quantity')::integer); end loop;
  if v_code is not null then insert into public.promotion_redemptions(promotion_id,order_id,customer_id,discount_grosz,status) values(v_promo.id,v_order.id,v_customer,v_discount,'reserved'); end if;
  update public.checkout_idempotency set order_id=v_order.id where idempotency_key=v_key;
  return jsonb_build_object('orderId',v_order.id,'orderNumber',v_order.order_number,'totalGrosz',v_total);
end $$;
revoke all on function public.create_checkout_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb) to service_role;
