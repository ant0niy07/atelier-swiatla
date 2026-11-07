export const fulfillmentStatuses = [
  'new',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type FulfillmentStatus = (typeof fulfillmentStatuses)[number];

const nextFulfillment: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  new: ['awaiting_payment', 'paid', 'processing', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransitionFulfillment(current: FulfillmentStatus, next: FulfillmentStatus) {
  return nextFulfillment[current].includes(next);
}

/** Test orders are retained for audit purposes but never join operational views. */
export function belongsInOperationalOrderViews(isTest: boolean | null | undefined) {
  return isTest !== true;
}
