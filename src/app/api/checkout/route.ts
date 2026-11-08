import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkoutRequestHash } from '@/lib/checkout-hash';
import { notifyTelegramOrder } from '@/lib/telegram';
import { requestSubjectHash } from '@/lib/request-rate-limit';

const schema = z.object({
  idempotencyKey: z.string().uuid(),
  customer: z.object({
    firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), email: z.string().trim().email(),
    phone: z.string().trim().min(7), street: z.string().trim().min(3), postalCode: z.string().trim().min(4), city: z.string().trim().min(2),
  }),
  deliveryMethodId: z.string().uuid(),
  paymentMethod: z.enum(['blik_before_dispatch', 'cod', 'pay_on_local_delivery']),
  lockerCode: z.string().trim().max(40).optional(),
  note: z.string().trim().max(1000).optional(),
  promoCode: z.string().trim().max(40).optional(),
  items: z.array(z.object({ sku: z.string().trim().min(1).max(100), variantId: z.string().trim().max(100).optional(), quantity: z.number().int().min(1).max(20) })).min(1).max(20),
});

const checkoutErrors = new Set([
  'IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_IN_PROGRESS', 'IDEMPOTENCY_INVALID', 'INVALID_ORDER', 'CUSTOMER_INVALID',
  'ITEMS_INVALID', 'DUPLICATE_SKU', 'PRODUCT_INVALID', 'QUANTITY_INVALID', 'STOCK_INVALID', 'DELIVERY_INVALID',
  'DELIVERY_MINIMUM_NOT_MET', 'PAYMENT_INVALID', 'LOCKER_INVALID', 'BLIK_NOT_CONFIGURED', 'ORDERS_NOT_ACCEPTED',
  'PROMOTION_INVALID', 'PROMOTION_INELIGIBLE', 'TOTAL_INVALID',
]);

function rpcErrorCode(message?: string) {
  const code = (message ?? '').match(/[A-Z_]+/)?.[0] ?? 'ORDER_REJECTED';
  return checkoutErrors.has(code) ? code : 'ORDER_REJECTED';
}

async function deliverPendingTelegram(orderId: string) {
  const db = getSupabaseAdmin();
  if (!db) return;
  const { error: claimError } = await db.rpc('claim_telegram_notification', { p_order_id: orderId });
  if (claimError) return;
  const { data: order } = await db.from('orders').select('id,order_number,total_grosz,order_items(product_name,quantity)').eq('id', orderId).single();
  if (!order) {
    await db.from('telegram_notifications').update({ status: 'failed', last_error: 'ORDER_NOT_FOUND', updated_at: new Date().toISOString() }).eq('order_id', orderId);
    return;
  }
  const result = await notifyTelegramOrder(order);
  await db.from('telegram_notifications').update({
    status: result.sent ? 'sent' : 'failed', last_error: result.sent ? null : result.reason ?? 'SEND_FAILED',
    sent_at: result.sent ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }).eq('order_id', orderId).eq('status', 'sending');
}

export async function POST(request: Request) {
  const db = getSupabaseAdmin();
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!db) return NextResponse.json({ error: 'CHECKOUT_UNAVAILABLE' }, { status: 503 });
  const { data: allowed, error: rateError } = await db.rpc('consume_api_rate_limit', { p_scope: 'checkout', p_subject_hash: requestSubjectHash(request.headers), p_limit: 8, p_window_seconds: 300 });
  if (rateError || !allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  if (!body.success || new Set(body.data.items.map((item) => item.sku.toUpperCase())).size !== body.data.items.length) return NextResponse.json({ error: 'INVALID_ORDER' }, { status: 400 });
  const requestHash = checkoutRequestHash(body.data);
  const { data, error } = await db.rpc('create_checkout_order', { p_request: { ...body.data, requestHash } });
  if (error || !data?.orderId) return NextResponse.json({ error: rpcErrorCode(error?.message) }, { status: 400 });
  if (!data.repeated) {
    // `after` is backed by Vercel's waitUntil primitive, unlike an untracked
    // Promise which can be abandoned as soon as a serverless response ends.
    after(() => deliverPendingTelegram(data.orderId));
  }
  const { data: operations } = await db.from('store_settings').select('value').eq('key', 'store_operations').maybeSingle();
  const config = operations?.value as { blik_phone?: string } | undefined;
  const blikRecipientPhone = data.paymentMethod === 'blik_before_dispatch' ? config?.blik_phone?.trim() : undefined;
  // The RPC already rejects a BLIK order without this configured value. Keep
  // the confirmation defensive if settings change between transaction and read.
  if (data.paymentMethod === 'blik_before_dispatch' && !blikRecipientPhone) return NextResponse.json({ error: 'BLIK_NOT_CONFIGURED' }, { status: 503 });
  return NextResponse.json({ ...data, blikRecipientPhone });
}

export async function GET() {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: 'CHECKOUT_UNAVAILABLE' }, { status: 503 });
  const [{ data: deliveryMethods, error }, { data: operations }] = await Promise.all([
    db.from('delivery_methods').select('id,label,kind,rate_grosz,minimum_order_grosz,supports_blik_before_dispatch,supports_cod').eq('active', true).not('rate_grosz', 'is', null).order('label'),
    db.from('store_settings').select('value').eq('key', 'store_operations').maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: 'DELIVERY_UNAVAILABLE' }, { status: 500 });
  const config = operations?.value as { accepting_orders?: boolean; blik_phone?: string } | undefined;
  return NextResponse.json({ deliveryMethods, acceptingOrders: config?.accepting_orders !== false, blikAvailable: Boolean(config?.blik_phone?.trim()) });
}
