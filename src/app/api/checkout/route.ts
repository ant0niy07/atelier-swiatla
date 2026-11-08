import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notifyTelegramOrder } from '@/lib/telegram';

const schema = z.object({
  idempotencyKey: z.string().uuid(),
  customer: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email(), phone: z.string().min(7), street: z.string().min(3), postalCode: z.string().min(4), city: z.string().min(2) }),
  deliveryMethodId: z.string().uuid(), paymentMethod: z.enum(['blik_before_dispatch', 'cod', 'pay_on_local_delivery']), note: z.string().max(1000).optional(), promoCode: z.string().max(40).optional(),
  items: z.array(z.object({ sku: z.string().min(1), variantId: z.string().optional(), quantity: z.number().int().min(1).max(20) })).min(1).max(20),
});

export async function POST(request: Request) {
  const db = getSupabaseAdmin(); const body = schema.safeParse(await request.json().catch(() => null));
  if (!db) return NextResponse.json({ error: 'CHECKOUT_UNAVAILABLE' }, { status: 503 });
  if (!body.success || new Set(body.data.items.map((item) => item.sku)).size !== body.data.items.length) return NextResponse.json({ error: 'INVALID_ORDER' }, { status: 400 });
  const requestHash = createHash('sha256').update(JSON.stringify({ items: body.data.items, deliveryMethodId: body.data.deliveryMethodId, paymentMethod: body.data.paymentMethod, promoCode: body.data.promoCode ?? '' })).digest('hex');
  const { data, error } = await db.rpc('create_checkout_order', { p_request: { ...body.data, requestHash } });
  if (error || !data?.orderId) return NextResponse.json({ error: 'ORDER_REJECTED' }, { status: 400 });
  if (!data.repeated) {
    const { data: notificationOrder } = await db.from('orders').select('order_number,total_grosz,customer_note,order_items(product_name,quantity)').eq('id', data.orderId).single();
    if (notificationOrder) await notifyTelegramOrder(notificationOrder);
  }
  return NextResponse.json(data);
}

export async function GET() {
  const db = getSupabaseAdmin(); if (!db) return NextResponse.json({ error: 'CHECKOUT_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await db.from('delivery_methods').select('id,label,kind,rate_grosz,supports_blik_before_dispatch,supports_cod').eq('active', true).not('rate_grosz', 'is', null).order('label');
  return error ? NextResponse.json({ error: 'DELIVERY_UNAVAILABLE' }, { status: 500 }) : NextResponse.json({ deliveryMethods: data });
}
