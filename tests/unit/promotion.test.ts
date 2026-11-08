import { describe, expect, it } from 'vitest';
import { calculatePromotion, normalizePromotionCode } from '@/lib/promotion';

const base = {
  code: 'SWIETA15', kind: 'percentage' as const, value: 15, minOrderGrosz: 0,
  active: true, startsAt: '2020-01-01T00:00:00Z',
};
const candles = [{ productId: 'amber', category: 'glass', unitGrosz: 4490, quantity: 2 }];

describe('global promotion calculator', () => {
  it('uses the full order, including delivery, for a 10% code', () => {
    const result = calculatePromotion({ ...base, value: 10 }, [{ productId: 'a', category: 'glass', unitGrosz: 6980, quantity: 1 }], 1200);
    expect(result).toMatchObject({ ok: true, discountGrosz: 818, eligibleSubtotalGrosz: 8180 });
  });

  it.each([[15, 1227], [20, 1636]])('calculates %i%% from products and delivery', (percentage, expected) => {
    expect(calculatePromotion({ ...base, value: percentage }, [{ productId: 'a', category: 'glass', unitGrosz: 6980, quantity: 1 }], 1200)).toMatchObject({ ok: true, discountGrosz: expected });
  });

  it('rounds percentage discounts down to whole grosz', () => {
    expect(calculatePromotion({ ...base, value: 15 }, [{ productId: 'mini', category: 'glass', unitGrosz: 4490, quantity: 1 }], 1200)).toMatchObject({ ok: true, discountGrosz: 853 });
  });

  it('applies a fixed discount against the full order and never makes it negative', () => {
    expect(calculatePromotion({ ...base, kind: 'fixed', value: 3990 }, [{ productId: 'a', category: 'glass', unitGrosz: 3000, quantity: 1 }], 1200)).toMatchObject({ ok: true, discountGrosz: 3990 });
    expect(calculatePromotion({ ...base, kind: 'fixed', value: 9999 }, [{ productId: 'a', category: 'glass', unitGrosz: 3000, quantity: 1 }], 1200)).toMatchObject({ ok: true, discountGrosz: 4200 });
  });

  it('caps a global percentage discount after including delivery', () => {
    expect(calculatePromotion({ ...base, value: 20, maxDiscountGrosz: 1000 }, [{ productId: 'a', category: 'glass', unitGrosz: 6980, quantity: 1 }], 1200)).toMatchObject({ ok: true, discountGrosz: 1000 });
  });

  it('includes paid personalization add-ons in the discount base', () => {
    const order = [
      { productId: 'amber', category: 'glass', unitGrosz: 4490, quantity: 1 },
      { productId: 'personalizacja', category: 'addon', unitGrosz: 3990, quantity: 1 },
    ];
    expect(calculatePromotion({ ...base, value: 10 }, order, 1200)).toMatchObject({ ok: true, discountGrosz: 968, eligibleSubtotalGrosz: 9680 });
  });

  it('keeps free-shipping promotions shipping-only', () => {
    expect(calculatePromotion({ ...base, kind: 'free_shipping', value: 1 }, candles, 1200)).toMatchObject({ ok: true, discountGrosz: 0, freeShipping: true, eligibleSubtotalGrosz: 10180 });
  });

  it('ignores legacy product, category and exclusion rules for new global promotions', () => {
    const legacyRuleFields = {
      eligibleProductIds: ['different-product'], eligibleCategories: ['different-category'], excludedProductIds: ['amber'],
    };
    const legacyPromotion = { ...base, ...legacyRuleFields };
    expect(calculatePromotion(legacyPromotion, candles, 1200)).toMatchObject({ ok: true, discountGrosz: 1527 });
  });

  it('keeps product subtotal minimums and date checks intact', () => {
    expect(calculatePromotion({ ...base, minOrderGrosz: 10000 }, candles, 1200)).toMatchObject({ ok: false, reason: 'minimum' });
    expect(calculatePromotion({ ...base, endsAt: '2021-01-01T00:00:00Z' }, candles, 1200)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('normalizes promotion input consistently', () => {
    expect(normalizePromotionCode(' święta15 ')).toBe('ŚWIĘTA15');
  });
});
