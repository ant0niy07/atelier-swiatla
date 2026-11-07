import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';

const kinds = ['inpost_locker', 'courier', 'courier_cod', 'inpost_locker_cod', 'local_warsaw'] as const;
const schema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(kinds),
  label: z.string().trim().min(2).max(120),
  active: z.boolean(),
  supports_blik_before_dispatch: z.boolean(),
  supports_cod: z.boolean(),
  rate_grosz: z.number().int().min(0).max(100_000).nullable(),
  description: z.string().trim().max(500).nullable().optional(),
  service_area: z.string().trim().max(200).nullable().optional(),
  available_days: z.string().trim().max(100).nullable().optional(),
  minimum_order_grosz: z.number().int().min(0).max(10_000_000).nullable().optional(),
}).superRefine((value, context) => {
  if ((value.kind === 'courier_cod' || value.kind === 'inpost_locker_cod') !== value.supports_cod) {
    context.addIssue({ code: 'custom', message: 'Niezgodna metoda pobrania.' });
  }
});

export async function POST(request: Request) {
  let db;
  try { ({ client: db } = await requireAdminService()); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_DELIVERY' }, { status: 400 });
  const { id, ...delivery } = parsed.data;
  const query = id ? db.from('delivery_methods').update(delivery).eq('id', id) : db.from('delivery_methods').insert(delivery);
  const { data, error } = await query.select().single();
  return error ? NextResponse.json({ error: 'SAVE_FAILED' }, { status: 400 }) : NextResponse.json({ delivery: data });
}
