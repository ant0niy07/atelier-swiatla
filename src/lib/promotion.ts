export type Promotion = {
  code: string;
  kind: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  minOrderGrosz: number;
  maxDiscountGrosz?: number | null;
  active: boolean;
  startsAt: string;
  endsAt?: string | null;
};
export type CartLine = { productId: string; category: string; unitGrosz: number; quantity: number };
export type PromotionResult =
  | { ok: true; code: string; discountGrosz: number; freeShipping: boolean; eligibleSubtotalGrosz: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'future' | 'disabled' | 'minimum' | 'empty' };

const money = (value: number) => Math.max(0, Math.round(value));
export function normalizePromotionCode(code: string) { return code.trim().toLocaleUpperCase('pl-PL'); }

/**
 * Promotions are global order discounts. The merchandise subtotal still gates
 * a configured minimum, while percentage/fixed discounts use merchandise plus
 * authoritative delivery. Product/category rules are deliberately ignored.
 */
export function calculatePromotion(promotion: Promotion | undefined, lines: CartLine[], shippingGrosz = 0, now = new Date()): PromotionResult {
  if (!promotion) return { ok: false, reason: 'invalid' };
  if (!promotion.active) return { ok: false, reason: 'disabled' };
  if (new Date(promotion.startsAt) > now) return { ok: false, reason: 'future' };
  if (promotion.endsAt && new Date(promotion.endsAt) <= now) return { ok: false, reason: 'expired' };
  const subtotal = lines.reduce((sum, line) => sum + money(line.unitGrosz) * Math.max(0, Math.floor(line.quantity)), 0);
  if (!subtotal) return { ok: false, reason: 'empty' };
  if (subtotal < promotion.minOrderGrosz) return { ok: false, reason: 'minimum' };
  const discountBase = subtotal + money(shippingGrosz);
  if (promotion.kind === 'free_shipping') return { ok: true, code: normalizePromotionCode(promotion.code), discountGrosz: 0, freeShipping: true, eligibleSubtotalGrosz: discountBase };
  const raw = promotion.kind === 'percentage' ? Math.floor(discountBase * promotion.value / 100) : promotion.value;
  const capped = promotion.maxDiscountGrosz == null ? raw : Math.min(raw, promotion.maxDiscountGrosz);
  return { ok: true, code: normalizePromotionCode(promotion.code), discountGrosz: Math.min(discountBase, money(capped)), freeShipping: false, eligibleSubtotalGrosz: discountBase };
}
