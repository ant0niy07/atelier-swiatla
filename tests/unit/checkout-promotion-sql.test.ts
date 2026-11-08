import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261108012726_checkout_inventory_outbox_hardening.sql'),
  'utf8',
);

describe('authoritative global promotion checkout migration', () => {
  it('uses the product-plus-delivery base for percentage and fixed discounts', () => {
    expect(sql).toContain("v_discount := floor((v_subtotal + v_shipping) * v_promo.value / 100.0)::bigint");
    expect(sql).toContain("v_discount := least(v_subtotal + v_shipping, v_discount");
  });

  it('retains row locks and the usage-limit guard for atomic redemptions', () => {
    expect(sql).toContain('for update;');
    expect(sql).toContain('v_promo.used_count >= v_promo.usage_limit');
    expect(sql).toContain('update public.promotions set used_count = used_count + 1');
  });

  it('does not reintroduce legacy product/category eligibility filters', () => {
    expect(sql).not.toContain('promotion_product_rules');
    expect(sql).not.toContain('promotion_category_rules');
  });

  it('keeps the checkout order-status CASE expressions explicitly typed', () => {
    expect(sql).toContain('end)::public.manual_payment_status');
    expect(sql).toContain('end)::public.fulfillment_status');
  });
});
