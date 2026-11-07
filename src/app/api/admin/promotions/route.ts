import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';

const schema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/),
  kind: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.number().int().min(1),
  min_order_grosz: z.number().int().min(0),
  max_discount_grosz: z.number().int().min(0).nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().nullable(),
  usage_limit: z.number().int().min(1).nullable(),
  active: z.boolean(),
  internal_note: z.string().max(1000),
});

export async function POST(request: Request) {
  let db;
  try { ({ client: db } = await requireAdminService()); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROMOTION' }, { status: 400 });
  const promotion = parsed.data;
  if ((promotion.kind === 'percentage' && promotion.value > 100) || (promotion.kind === 'free_shipping' && promotion.value !== 1)) {
    return NextResponse.json({ error: 'INVALID_PROMOTION' }, { status: 400 });
  }
  const { id, ...values } = promotion;
  const query = id ? db.from('promotions').update(values).eq('id', id) : db.from('promotions').insert(values);
  const { data, error } = await query.select().single();
  return error ? NextResponse.json({ error: 'SAVE_FAILED' }, { status: 400 }) : NextResponse.json({ promotion: data });
}
