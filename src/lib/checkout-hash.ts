import { createHash } from 'node:crypto';

type Scalar = null | boolean | number | string;
type CanonicalValue = Scalar | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalize(value: unknown): CanonicalValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return String(value);
}

const clean = (value: unknown) => String(value ?? '').trim();

/**
 * Canonical order identity. Item order is intentionally irrelevant: a cart
 * with the same SKUs and quantities is the same requested order on a retry.
 */
export function canonicalCheckoutRequest(value: Record<string, unknown>) {
  const customer = (value.customer ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(value.items) ? value.items as Array<Record<string, unknown>> : [];
  return canonicalize({
    customer: {
      firstName: clean(customer.firstName),
      lastName: clean(customer.lastName),
      email: clean(customer.email).toLocaleLowerCase('en-US'),
      phone: clean(customer.phone).replace(/[\s()-]/g, ''),
      street: clean(customer.street),
      postalCode: clean(customer.postalCode).toLocaleUpperCase('pl-PL'),
      city: clean(customer.city),
    },
    deliveryMethodId: clean(value.deliveryMethodId),
    paymentMethod: clean(value.paymentMethod),
    promoCode: clean(value.promoCode).toLocaleUpperCase('pl-PL'),
    note: clean(value.note),
    lockerCode: clean(value.lockerCode).toLocaleUpperCase('pl-PL'),
    items: rawItems
      .map((item) => ({ sku: clean(item.sku).toLocaleUpperCase('en-US'), variantId: clean(item.variantId), quantity: Number(item.quantity) }))
      .sort((left, right) => left.sku.localeCompare(right.sku) || left.variantId.localeCompare(right.variantId)),
  });
}

export function checkoutRequestHash(value: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(canonicalCheckoutRequest(value))).digest('hex');
}
