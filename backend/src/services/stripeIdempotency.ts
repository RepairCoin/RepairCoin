import { createHash } from 'crypto';

/**
 * Build a STABLE Stripe idempotency key from a domain-scoped operation id.
 *
 * Passing this to a `stripe.*.create` call makes retries safe: on a retry Stripe returns the
 * ORIGINAL result instead of creating a duplicate charge/refund/invoice. The key must be
 * deterministic for "the same operation" — derive it from a stable id (order id, invoice id,
 * PaymentIntent id), never from a random value or a timestamp.
 *
 *   createPaymentIntent(params, { idempotencyKey: idemKey('booking-pi', orderDraftId) })
 */
export function idemKey(scope: string, id: string): string {
  return `fixflow:${scope}:${id}`;
}

/**
 * Stable reference for a booking payment attempt, derived from what the customer actually
 * chose rather than from a server-generated id.
 *
 * The order id can't be used here: both booking flows mint `ord_<uuid>` fresh on every
 * request, so a double-clicked "Book" button would produce two different keys and two
 * PaymentIntents — exactly the duplicate charge the key exists to prevent. Hashing the
 * booking inputs means a retry of the SAME booking reuses the same PaymentIntent, while a
 * genuinely different booking (other slot, other service, other amount) gets its own key.
 *
 * Note Stripe expires idempotency keys after 24h, which is the effective dedup window.
 */
export function bookingIdemRef(parts: {
  customerAddress: string;
  serviceId: string;
  bookingDate?: string;
  bookingTime?: string;
  amountCents: number;
}): string {
  const basis = [
    parts.customerAddress.toLowerCase(),
    parts.serviceId,
    parts.bookingDate || '',
    parts.bookingTime || '',
    String(parts.amountCents),
  ].join('|');
  return createHash('sha1').update(basis).digest('hex');
}
