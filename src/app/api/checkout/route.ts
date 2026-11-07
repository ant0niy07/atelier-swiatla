import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyTelegramOrder } from '@/lib/telegram';

const schema = z.object({
  idempotencyKey: z.string().uuid(),
  customer: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email(), phone: z.string().min(7), street: z.string().min(3), postalCode: z.string().min(4), city: z.string().min(2) }),
  deliveryMethodId: z.string().uuid(),
  paymentMethod: z.enum(['blik_before_dispatch', 'cod', 'pay_on_local_delivery']),
  note: z.string().max(1000).optional(),
  promoCode: z.string().max(40).optional(),
  items: z.array(z.object({ sku: z.string().min(1), variantId: z.string().optional(), quantity: z.number().int().min(1).max(20) })).min(1),
});

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Konfiguracja zamówień nie jest jeszcze dostępna.' }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Sprawdź dane zamówienia.' }, { status: 400 });
  const body = parsed.data;
  const requestHash = JSON.stringify({ items: body.items, deliveryMethodId: body.deliveryMethodId, paymentMethod: body.paymentMethod, promoCode: body.promoCode ?? '' });
  const { error: lockError } = await db.from('checkout_idempotency').insert({ idempotency_key: body.idempotencyKey, request_hash: requestHash });
  if (lockError) {
    const { data: existing } = await db.from('checkout_idempotency').select('order_id,request_hash').eq('idempotency_key', body.idempotencyKey).maybeSingle();
    if (existing?.request_hash !== requestHash) return NextResponse.json({ error: 'Nieprawidłowa ponowna próba zamówienia.' }, { status: 409 });
    if (existing?.order_id) {
      const { data: previousOrder } = await db.from('orders').select('id,order_number,manual_payment_status').eq('id', existing.order_id).maybeSingle();
      if (previousOrder) return NextResponse.json({ orderId: previousOrder.id, orderNumber: previousOrder.order_number, paymentStatus: previousOrder.manual_payment_status, repeated: true });
    }
    return NextResponse.json({ error: 'Zamówienie jest już przetwarzane. Odczekaj chwilę.' }, { status: 409 });
  }
  const { data: delivery, error: deliveryError } = await db.from('delivery_methods').select('*').eq('id', body.deliveryMethodId).eq('active', true).maybeSingle();
  if (deliveryError || !delivery || delivery.rate_grosz === null) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Wybrana dostawa nie jest obecnie dostępna.' }, { status: 400 }); }
  const isLocal = delivery.kind === 'local_warsaw';
  if ((body.paymentMethod === 'cod' && !delivery.supports_cod) || (body.paymentMethod === 'blik_before_dispatch' && !delivery.supports_blik_before_dispatch) || (body.paymentMethod === 'pay_on_local_delivery' && !isLocal)) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Ta metoda płatności nie jest dostępna dla wybranej dostawy.' }, { status: 400 }); }
  const { data: catalog, error: catalogError } = await db.from('products').select('id,sku,name,price_grosz,stock_on_hand,stock_reserved,made_to_order,status').in('sku', body.items.map((item) => item.sku)).eq('status', 'published');
  if (catalogError || !catalog || catalog.length !== body.items.length) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Co najmniej jeden produkt nie jest dostępny.' }, { status: 400 }); }
  const lines = body.items.map((item) => ({ item, product: catalog.find((product) => product.sku === item.sku)! }));
  if (lines.some(({ item, product }) => !product.made_to_order && product.stock_on_hand - product.stock_reserved < item.quantity)) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Brak wystarczającej dostępności produktu.' }, { status: 409 }); }
  const subtotal = lines.reduce((sum, { item, product }) => sum + product.price_grosz * item.quantity, 0);
  // Promotions are deliberately not accepted here until the checkout RPC is applied:
  // capped use needs one database transaction, not independent browser/server writes.
  if (body.promoCode) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Kod promocyjny wymaga aktywnej konfiguracji promocji.' }, { status: 400 }); }
  const paymentStatus = body.paymentMethod === 'cod' || body.paymentMethod === 'pay_on_local_delivery' ? 'cod_pending' : 'awaiting_payment';
  const { data: customer, error: customerError } = await db.from('customers').upsert({ email: body.customer.email, first_name: body.customer.firstName, last_name: body.customer.lastName, phone: body.customer.phone }, { onConflict: 'email' }).select('id').single();
  if (customerError || !customer) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Nie udało się zapisać danych klienta.' }, { status: 500 }); }
  const { data: order, error: orderError } = await db.from('orders').insert({ customer_id: customer.id, email: body.customer.email, status: 'pending_payment', payment_status: 'awaiting', manual_payment_status: paymentStatus, fulfillment_status: body.paymentMethod === 'blik_before_dispatch' ? 'awaiting_payment' : 'new', payment_method: body.paymentMethod, shipping_method: delivery.label, delivery_kind: delivery.kind, shipping_grosz: delivery.rate_grosz, subtotal_grosz: subtotal, discount_grosz: 0, total_grosz: subtotal + delivery.rate_grosz, address: { ...body.customer, note: body.note ?? '' }, customer_note: body.note ?? '' }).select('id,order_number').single();
  if (orderError || !order) { await db.from('checkout_idempotency').delete().eq('idempotency_key', body.idempotencyKey); return NextResponse.json({ error: 'Nie udało się utworzyć zamówienia.' }, { status: 500 }); }
  const { error: itemsError } = await db.from('order_items').insert(lines.map(({ item, product }) => ({ order_id: order.id, product_id: product.id, sku: product.sku, product_name: item.variantId ? `${product.name} — ${item.variantId}` : product.name, unit_price_grosz: product.price_grosz, quantity: item.quantity, line_total_grosz: product.price_grosz * item.quantity })));
  if (itemsError) { await db.from('orders').delete().eq('id', order.id); return NextResponse.json({ error: 'Nie udało się zapisać pozycji zamówienia.' }, { status: 500 }); }
  await db.from('checkout_idempotency').update({ order_id: order.id }).eq('idempotency_key', body.idempotencyKey);
  const { data: notificationOrder } = await db.from('orders').select('order_number,total_grosz,customer_note,order_items(product_name,quantity)').eq('id', order.id).single();
  if (notificationOrder) await notifyTelegramOrder(notificationOrder);
  return NextResponse.json({ orderId: order.id, orderNumber: order.order_number, paymentStatus });
}

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'Konfiguracja zamówień nie jest dostępna.' }, { status: 503 });
  const { data, error } = await db.from('delivery_methods').select('id,label,kind,rate_grosz,supports_blik_before_dispatch,supports_cod').eq('active', true).not('rate_grosz', 'is', null).order('label');
  if (error) return NextResponse.json({ error: 'Nie udało się pobrać metod dostawy.' }, { status: 500 });
  return NextResponse.json({ deliveryMethods: data });
}
