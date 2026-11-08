import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calculatePromotion, normalizePromotionCode } from '@/lib/promotion';

const schema = z.object({ code: z.string().min(1).max(40), items: z.array(z.object({ sku: z.string(), quantity: z.number().int().min(1).max(20) })).min(1), shippingGrosz: z.number().int().min(0) });
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  const db = getSupabaseAdmin();
  if (!body.success || !db) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  const code = normalizePromotionCode(body.data.code);
  const [{ data: promotion }, { data: products }] = await Promise.all([
    db.from('promotions').select('*').eq('code', code).maybeSingle(),
    db.from('products').select('id,sku,price_grosz,category_id').in('sku', body.data.items.map((item) => item.sku)),
  ]);
  if (!promotion || !products || products.length !== body.data.items.length || (promotion.usage_limit !== null && promotion.used_count >= promotion.usage_limit)) return NextResponse.json({ error: 'INVALID_PROMOTION' }, { status: 400 });
  const result = calculatePromotion({ code: promotion.code, kind: promotion.kind, value: promotion.value, minOrderGrosz: promotion.min_order_grosz, maxDiscountGrosz: promotion.max_discount_grosz, active: promotion.active, startsAt: promotion.starts_at, endsAt: promotion.ends_at }, body.data.items.map((item) => { const p = products.find((product) => product.sku === item.sku)!; return { productId: p.id, category: p.category_id ?? '', unitGrosz: p.price_grosz, quantity: item.quantity }; }));
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  const subtotal = body.data.items.reduce((sum, item) => sum + products.find((p) => p.sku === item.sku)!.price_grosz * item.quantity, 0);
  const shipping = result.freeShipping ? 0 : body.data.shippingGrosz;
  return NextResponse.json({ code: result.code, subtotalGrosz: subtotal, discountGrosz: result.discountGrosz, shippingGrosz: shipping, totalGrosz: Math.max(0, subtotal - result.discountGrosz + shipping) });
}
