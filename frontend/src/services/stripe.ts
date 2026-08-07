import {
  loadStripe,
  type Stripe,
  type StripeConstructorOptions,
} from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** False when the key is absent, so a caller can say so instead of rendering a dead card form. */
export const stripeConfigured = Boolean(publishableKey);

/**
 * The only place the publishable key is read.
 *
 * It never falls back to a literal key. A hardcoded one belongs to whichever account it was
 * copied from, so a missing env var would quietly point card entry at a stranger's Stripe
 * account — and a test-mode key against a live backend takes card details that never charge,
 * with the customer seeing a success screen either way. An empty string is no better: Stripe
 * rejects it in the console and the form simply never mounts, which reads as a broken page
 * rather than a misconfigured one.
 *
 * Resolves to null instead, so the absence is something the UI can state.
 */
export function getStripe(
  options?: StripeConstructorOptions
): Promise<Stripe | null> {
  if (!publishableKey) return Promise.resolve(null);
  return loadStripe(publishableKey, options);
}

/** Shared platform-account instance. Connected-account contexts call getStripe() themselves. */
export const stripePromise = getStripe();
