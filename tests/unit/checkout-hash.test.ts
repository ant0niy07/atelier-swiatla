import { describe, expect, it } from 'vitest';
import { checkoutRequestHash } from '@/lib/checkout-hash';

const base = { customer: { email: 'a@example.test', firstName: 'A' }, items: [{ sku: 'XMAS-AMBER-180', quantity: 1 }], deliveryMethodId: 'delivery', paymentMethod: 'blik_before_dispatch', promoCode: 'ATELIER10', note: '' };
describe('checkout idempotency request hash', () => {
  it('is stable for an identical retry', () => expect(checkoutRequestHash(base)).toBe(checkoutRequestHash({ ...base })));
  it.each([{ note: 'other' }, { paymentMethod: 'cod' }, { customer: { ...base.customer, email: 'b@example.test' } }, { items: [{ sku: 'XMAS-AMBER-180', quantity: 2 }] }])('changes for conflicting order data', (change) => expect(checkoutRequestHash(base)).not.toBe(checkoutRequestHash({ ...base, ...change })));
  it('normalizes equivalent formatting and irrelevant item order', () => {
    const twoItems = { ...base, promoCode: ' atelier10 ', customer: { ...base.customer, email: ' A@EXAMPLE.TEST ', phone: ' 123 456 789 ' }, items: [{ sku: 'XMAS-TREE-001', quantity: 1 }, ...base.items] };
    const retry = { ...twoItems, promoCode: 'ATELIER10', customer: { ...twoItems.customer, email: 'a@example.test', phone: '123456789' }, items: [...twoItems.items].reverse() };
    expect(checkoutRequestHash(twoItems)).toBe(checkoutRequestHash(retry));
  });
});
