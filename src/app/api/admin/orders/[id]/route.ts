import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';
import { canTransitionFulfillment, type FulfillmentStatus } from '@/lib/order-workflow';

const fulfillment = ['new', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
const payment = ['awaiting_payment', 'cod_pending', 'paid', 'carrier_collected', 'settled', 'cancelled'] as const;
const schema = z.object({
  fulfillment_status: z.enum(fulfillment).optional(),
  manual_payment_status: z.enum(payment).optional(),
  carrier_name: z.string().trim().max(120).nullable().optional(),
  tracking_number: z.string().trim().max(160).nullable().optional(),
  internal_note: z.string().trim().max(2000).optional(),
  is_test: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let db;
  try {
    ({ client: db } = await requireAdminService());
  } catch {
    return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
  }
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success || !Object.keys(body.data).length) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 });
  const { id } = await params;
  const { data: current } = await db.from('orders').select('fulfillment_status,manual_payment_status,carrier_name,tracking_number').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Nie znaleziono zamówienia.' }, { status: 404 });
  if (body.data.fulfillment_status && body.data.fulfillment_status !== current.fulfillment_status && !canTransitionFulfillment(current.fulfillment_status as FulfillmentStatus, body.data.fulfillment_status)) {
    return NextResponse.json({ error: 'Niedozwolona zmiana etapu realizacji.' }, { status: 400 });
  }

  const { internal_note, is_test, fulfillment_status, manual_payment_status, carrier_name, tracking_number } = body.data;
  // Classification is deliberately independent from fulfillment. A restored test
  // order keeps its original status and payment/audit history rather than being
  // silently left in the cancelled state.
  if (fulfillment_status || manual_payment_status || carrier_name !== undefined || tracking_number !== undefined || internal_note) {
    const { error } = await db.rpc('transition_order_fulfillment', {
      p_order_id: id,
      p_next: fulfillment_status ?? current.fulfillment_status,
      p_manual: manual_payment_status ?? current.manual_payment_status,
      p_carrier: carrier_name === undefined ? current.carrier_name : carrier_name,
      p_tracking: tracking_number === undefined ? current.tracking_number : tracking_number,
      p_note: internal_note ?? '',
    });
    if (error) return NextResponse.json({ error: 'Nie udało się bezpiecznie zapisać zmian.' }, { status: 400 });
  }
  if (is_test !== undefined) {
    const { error } = await db.from('orders').update({ is_test, hidden_at: is_test ? new Date().toISOString() : null }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Nie udało się zapisać klasyfikacji.' }, { status: 500 });
  }
  if (is_test !== undefined) {
    await db.from('order_status_history').insert({
      order_id: id,
      status: fulfillment_status ?? current.fulfillment_status,
      note: internal_note ?? (is_test ? 'TEST_ORDER_HIDDEN' : is_test === false ? 'TEST_ORDER_RESTORED' : ''),
    });
  }
  return NextResponse.json({ ok: true });
}
