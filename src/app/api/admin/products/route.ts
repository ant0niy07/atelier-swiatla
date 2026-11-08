import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(160),
  sku: z.string().trim().min(2).max(80),
  description: z.string().max(10_000),
  price_grosz: z.number().int().min(0).max(10_000_000),
  stock_on_hand: z.number().int().min(0).max(1_000_000),
  made_to_order: z.boolean(),
  status: z.enum(['draft', 'published', 'archived']),
  category_id: z.string().uuid().nullable().optional(),
  fragrance: z.string().trim().max(300).nullable().optional(),
});

export async function POST(request: Request) {
  let db;
  try {
    ({ client: db } = await requireAdminService());
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PRODUCT' }, { status: 400 });

  const { id, ...product } = parsed.data;
  const query = id
    ? db.from('products').update(product).eq('id', id)
    : db.from('products').insert(product);
  const { data, error } = await query.select().single();
  return error
    ? NextResponse.json({ error: 'SAVE_FAILED' }, { status: 400 })
    : NextResponse.json({ product: data });
}
