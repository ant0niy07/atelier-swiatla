import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';
import { notifyTelegramOrder } from '@/lib/telegram';

export async function POST(request: Request) {
  let db; try { ({ client: db } = await requireAdminService()); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const parsed = z.object({ orderId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_ORDER' }, { status: 400 });
  const { data: order } = await db.from('orders').select('id,order_number,total_grosz,customer_note,order_items(product_name,quantity)').eq('id', parsed.data.orderId).single();
  if (!order) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const sent = await notifyTelegramOrder(order);
  await db.from('telegram_notifications').upsert({ order_id: order.id, status: sent.sent ? 'sent' : 'failed', attempts: 1, last_error: sent.sent ? null : sent.reason ?? 'SEND_FAILED', sent_at: sent.sent ? new Date().toISOString() : null }, { onConflict: 'order_id' });
  return sent.sent ? NextResponse.json({ ok: true }) : NextResponse.json({ error: sent.reason ?? 'SEND_FAILED' }, { status: 503 });
}
