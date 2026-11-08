import { describe, expect, it } from 'vitest';
import { checkoutRequestHash } from '@/lib/checkout-hash';

const base = { customer: { email: 'a@example.test', firstName: 'A' }, items: [{ sku: 'XMAS-AMBER-180', quantity: 1 }], deliveryMethodId: 'delivery', paymentMethod: 'blik_before_dispatch', promoCode: 'ATELIER10', note: '' };
describe('checkout idempotency request hash', () => {
  it('is stable for an identical retry', () => expect(checkoutRequestHash(base)).toBe(checkoutRequestHash({ ...base })));
  it.each([{ note: 'other' }, { paymentMethod: 'cod' }, { customer: { ...base.customer, email: 'b@example.test' } }, { items: [{ sku: 'XMAS-AMBER-180', quantity: 2 }] }])('changes for conflicting order data', (change) => expect(checkoutRequestHash(base)).not.toBe(checkoutRequestHash({ ...base, ...change })));
});
