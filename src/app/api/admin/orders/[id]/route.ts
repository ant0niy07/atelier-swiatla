import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';

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

const nextFulfillment: Record<(typeof fulfillment)[number], readonly (typeof fulfillment)[number][]> = {
  new: ['awaiting_payment', 'paid', 'processing', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

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
  const { data: current } = await db.from('orders').select('fulfillment_status,manual_payment_status').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Nie znaleziono zamówienia.' }, { status: 404 });
  if (body.data.fulfillment_status && !nextFulfillment[current.fulfillment_status as keyof typeof nextFulfillment].includes(body.data.fulfillment_status)) {
    return NextResponse.json({ error: 'Niedozwolona zmiana etapu realizacji.' }, { status: 400 });
  }

  const { internal_note, is_test, ...changes } = body.data;
  const update = is_test === undefined ? changes : { ...changes, is_test, hidden_at: is_test ? new Date().toISOString() : null, fulfillment_status: is_test ? 'cancelled' : changes.fulfillment_status };
  const { error } = await db.from('orders').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: 'Nie udało się zapisać zmian.' }, { status: 500 });
  if (body.data.fulfillment_status || internal_note || is_test !== undefined) {
    await db.from('order_status_history').insert({
      order_id: id,
      status: body.data.fulfillment_status ?? current.fulfillment_status,
      note: internal_note ?? (is_test ? 'TEST_ORDER_HIDDEN' : is_test === false ? 'TEST_ORDER_RESTORED' : ''),
    });
  }
  return NextResponse.json({ ok: true });
}
