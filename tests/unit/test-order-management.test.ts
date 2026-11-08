import { describe, expect, it } from 'vitest';
import { belongsInOperationalOrderViews, canTransitionFulfillment } from '@/lib/order-workflow';

describe('test-order operational visibility', () => {
  it('keeps cancelled normal orders visible while hiding only test orders', () => {
    expect(belongsInOperationalOrderViews(false)).toBe(true);
    expect(belongsInOperationalOrderViews(null)).toBe(true);
    expect(belongsInOperationalOrderViews(true)).toBe(false);
  });

  it('does not require a cancellation transition when an order is classified as a test', () => {
    expect(canTransitionFulfillment('paid', 'processing')).toBe(true);
    expect(canTransitionFulfillment('paid', 'cancelled')).toBe(true);
    expect(canTransitionFulfillment('cancelled', 'processing')).toBe(false);
  });
});
