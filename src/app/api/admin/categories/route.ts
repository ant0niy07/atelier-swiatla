import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  active: z.boolean(),
});

export async function POST(request: Request) {
  let db;
  try {
    ({ client: db } = await requireAdminService());
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_CATEGORY' }, { status: 400 });

  const { id, ...category } = parsed.data;
  const query = id
    ? db.from('categories').update(category).eq('id', id)
    : db.from('categories').insert(category);
  const { data, error } = await query.select().single();
  return error
    ? NextResponse.json({ error: 'SAVE_FAILED' }, { status: 400 })
    : NextResponse.json({ category: data });
}
