import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calculatePromotion, normalizePromotionCode } from '@/lib/promotion';
import { requestSubjectHash } from '@/lib/request-rate-limit';

const schema = z.object({ code: z.string().min(1).max(40), deliveryMethodId: z.string().uuid(), items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1).max(20) });
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  const db = getSupabaseAdmin();
  if (!body.success || !db) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
  const { data: allowed, error: rateError } = await db.rpc('consume_api_rate_limit', { p_scope: 'promo-preview', p_subject_hash: requestSubjectHash(request.headers), p_limit: 30, p_window_seconds: 60 });
  if (rateError || !allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  const code = normalizePromotionCode(body.data.code);
  if (new Set(body.data.items.map((item) => item.sku)).size !== body.data.items.length) return NextResponse.json({ error: 'INVALID_ITEMS' }, { status: 400 });
  const [{ data: promotion, error: promotionError }, { data: products, error: productsError }, { data: delivery, error: deliveryError }] = await Promise.all([
    db.from('promotions').select('*').eq('code', code).maybeSingle(),
    db.from('products').select('id,sku,price_grosz,category_id,status').in('sku', body.data.items.map((item) => item.sku)).eq('status', 'published'),
    db.from('delivery_methods').select('rate_grosz,minimum_order_grosz').eq('id', body.data.deliveryMethodId).eq('active', true).maybeSingle(),
  ]);
  if (promotionError || productsError || deliveryError) return NextResponse.json({ error: 'QUOTE_UNAVAILABLE' }, { status: 503 });
  if (!promotion || promotion.archived_at || !products || products.length !== body.data.items.length || !delivery || delivery.rate_grosz === null || (promotion.usage_limit !== null && promotion.used_count >= promotion.usage_limit)) return NextResponse.json({ error: 'INVALID_PROMOTION' }, { status: 400 });
  // Percentage and fixed promotions are order-wide. Product/category rules are
  // intentionally not read for new quotes; delivery is in the discount base.
  const result = calculatePromotion(
    {
      code: promotion.code,
      kind: promotion.kind,
      value: promotion.value,
      minOrderGrosz: promotion.min_order_grosz,
      maxDiscountGrosz: promotion.max_discount_grosz,
      active: promotion.active,
      startsAt: promotion.starts_at,
      endsAt: promotion.ends_at,
    },
    body.data.items.map((item) => {
      const product = products.find((candidate) => candidate.sku === item.sku)!;
      return {
        productId: product.id,
        category: product.category_id ?? '',
        unitGrosz: product.price_grosz,
        quantity: item.quantity,
      };
    }),
    delivery.rate_grosz,
  );
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  const subtotal = body.data.items.reduce((sum, item) => sum + products.find((p) => p.sku === item.sku)!.price_grosz * item.quantity, 0);
  if (delivery.minimum_order_grosz !== null && subtotal < delivery.minimum_order_grosz) return NextResponse.json({ error: 'DELIVERY_MINIMUM_NOT_MET', minimumOrderGrosz: delivery.minimum_order_grosz }, { status: 400 });
  const shipping = result.freeShipping ? 0 : delivery.rate_grosz;
  return NextResponse.json({ code: result.code, subtotalGrosz: subtotal, discountGrosz: result.discountGrosz, shippingGrosz: shipping, totalGrosz: Math.max(0, subtotal - result.discountGrosz + shipping) });
}
