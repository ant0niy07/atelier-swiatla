import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calculatePromotion, normalizePromotionCode } from '@/lib/promotion';

const schema = z.object({ code: z.string().min(1).max(40), deliveryMethodId: z.string().uuid(), items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1).max(20) });
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  const db = getSupabaseAdmin();
  if (!body.success || !db) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  const code = normalizePromotionCode(body.data.code);
  if (new Set(body.data.items.map((item) => item.sku)).size !== body.data.items.length) return NextResponse.json({ error: 'INVALID_ITEMS' }, { status: 400 });
  const [{ data: promotion }, { data: products }, { data: delivery }] = await Promise.all([
    db.from('promotions').select('*').eq('code', code).maybeSingle(),
    db.from('products').select('id,sku,price_grosz,category_id,status').in('sku', body.data.items.map((item) => item.sku)).eq('status', 'published'),
    db.from('delivery_methods').select('rate_grosz').eq('id', body.data.deliveryMethodId).eq('active', true).maybeSingle(),
  ]);
  if (!promotion || !products || products.length !== body.data.items.length || !delivery || delivery.rate_grosz === null || (promotion.usage_limit !== null && promotion.used_count >= promotion.usage_limit)) return NextResponse.json({ error: 'INVALID_PROMOTION' }, { status: 400 });
  const [{ data: includeRules }, { data: categoryRules }, { data: excludeRules }] = await Promise.all([
    db.from('promotion_product_rules').select('product_id').eq('promotion_id', promotion.id).eq('excluded', false),
    db.from('promotion_category_rules').select('category_id').eq('promotion_id', promotion.id),
    db.from('promotion_product_rules').select('product_id').eq('promotion_id', promotion.id).eq('excluded', true),
  ]);
  const result = calculatePromotion({ code: promotion.code, kind: promotion.kind, value: promotion.value, minOrderGrosz: promotion.min_order_grosz, maxDiscountGrosz: promotion.max_discount_grosz, active: promotion.active, startsAt: promotion.starts_at, endsAt: promotion.ends_at, eligibleProductIds: includeRules?.map((rule) => rule.product_id), eligibleCategories: categoryRules?.map((rule) => rule.category_id), excludedProductIds: excludeRules?.map((rule) => rule.product_id) }, body.data.items.map((item) => { const p = products.find((product) => product.sku === item.sku)!; return { productId: p.id, category: p.category_id ?? '', unitGrosz: p.price_grosz, quantity: item.quantity }; }));
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  const subtotal = body.data.items.reduce((sum, item) => sum + products.find((p) => p.sku === item.sku)!.price_grosz * item.quantity, 0);
  const shipping = result.freeShipping ? 0 : delivery.rate_grosz;
  return NextResponse.json({ code: result.code, subtotalGrosz: subtotal, discountGrosz: result.discountGrosz, shippingGrosz: shipping, totalGrosz: Math.max(0, subtotal - result.discountGrosz + shipping) });
}
