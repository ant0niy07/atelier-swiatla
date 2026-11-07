import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin-auth';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let db;
  try {
    ({ client: db } = await requireAdminService());
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'INVALID_PRODUCT' }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const files = form?.getAll('images').filter((value): value is File => value instanceof File) ?? [];
  if (!files.length || files.length > 6 || files.some((file) => !allowedTypes.has(file.type) || file.size > MAX_FILE_SIZE)) {
    return NextResponse.json({ error: 'INVALID_IMAGE' }, { status: 400 });
  }

  const { data: product } = await db.from('products').select('id').eq('id', id).maybeSingle();
  if (!product) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const { data: existing } = await db.from('product_images')
    .select('position').eq('product_id', id).order('position', { ascending: false }).limit(1);
  let position = (existing?.[0]?.position ?? -1) + 1;
  const uploaded: { storage_path: string; position: number }[] = [];

  for (const file of files) {
    const extension = file.type.split('/')[1];
    const path = `${id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage.from('product-images').upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });
    if (!error) uploaded.push({ storage_path: path, position: position++ });
  }

  if (!uploaded.length) return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 400 });
  const { data, error } = await db.from('product_images').insert(
    uploaded.map((image) => ({ product_id: id, ...image })),
  ).select();
  if (error) {
    await db.storage.from('product-images').remove(uploaded.map((image) => image.storage_path));
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 400 });
  }
  return NextResponse.json({ images: data });
}
