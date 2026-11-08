import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';
import { notifyTelegramOrder } from '@/lib/telegram';

export async function POST(request: Request) {
  let db;
  try { ({ client: db } = await requireAdminService()); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const parsed = z.object({ orderId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ORDER' }, { status: 400 });
  const { error: claimError } = await db.rpc('claim_telegram_notification', { p_order_id: parsed.data.orderId });
  if (claimError) return NextResponse.json({ error: 'NOT_RETRYABLE' }, { status: 409 });
  const { data: order } = await db.from('orders').select('id,order_number,total_grosz,order_items(product_name,quantity)').eq('id', parsed.data.orderId).single();
  if (!order) {
    await db.from('telegram_notifications').update({ status: 'failed', last_error: 'ORDER_NOT_FOUND', updated_at: new Date().toISOString() }).eq('order_id', parsed.data.orderId);
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const result = await notifyTelegramOrder(order);
  await db.from('telegram_notifications').update({
    status: result.sent ? 'sent' : 'failed', last_error: result.sent ? null : result.reason ?? 'SEND_FAILED',
    sent_at: result.sent ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
  }).eq('order_id', order.id).eq('status', 'sending');
  return result.sent ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.reason ?? 'SEND_FAILED' }, { status: 503 });
}
