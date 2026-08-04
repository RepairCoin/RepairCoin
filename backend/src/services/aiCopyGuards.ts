// backend/src/services/aiCopyGuards.ts
//
// Checks that apply to ANY AI-written copy that reaches a customer unattended.
//
// The risk is not an imperfect sentence — it is a claim the shop is then bound by. "20% off your
// next service" must either be honoured or refused, and nobody at the shop agreed to it. That is
// true whether the copy is an in-app message or an email campaign, so the rule lives in one place
// rather than being reimplemented per surface with slightly different patterns.
//
// Same family as the validation RecommendationPhraser applies to AI-rewritten card copy, where any
// figure it cannot account for discards the whole rewrite.

/**
 * Claims that COMMIT THE SHOP TO SOMETHING.
 *
 * Deliberately NARROW. `free` and `guaranteed` are excluded because "feel free to call" is ordinary
 * friendly copy, and a guard that fires on it would silence workflows — the worse failure, and one
 * this codebase keeps relearning. High precision matters more than coverage: everything caught has
 * to be worth cancelling a message over.
 */
const OFFER_CLAIMS: ReadonlyArray<{ pattern: RegExp; what: string }> = [
  { pattern: /\d+\s*%/, what: 'a percentage' },
  { pattern: /[$£€₱]\s?\d/, what: 'a price' },
  { pattern: /\b(discount|coupon|voucher|promo code)\b/i, what: 'an offer' },
];

/**
 * Does this copy state an offer the shop never asked for?
 *
 * Returns a reason, or null when clean. A claim the OWNER put in their brief is allowed through — if
 * they wrote "offer 10% off", copy containing 10% is doing as it was told.
 */
export function statesUnaskedOffer(text: string, brief?: string): string | null {
  const asked = (brief ?? '').toLowerCase();
  for (const { pattern, what } of OFFER_CLAIMS) {
    if (pattern.test(text) && !pattern.test(asked)) {
      return `states ${what} the brief never asked for`;
    }
  }
  return null;
}
