// backend/src/utils/apportionTax.ts
/**
 * Split a sale's tax across the ledger rows written for it (POS S9c-1).
 *
 * Tax belongs to the sale, but the fiat ledger stores one row per tender, and revenue is computed
 * as `gross_cents - tax_cents` on each row. So the sale's tax has to be distributed across those
 * rows in a way that sums back to exactly what was charged — integer division alone does not, and a
 * cent lost per split sale is a ledger that slowly stops reconciling.
 */

export interface ApportionableTender {
  id: string;
  amountCents: number;
}

/**
 * Returns tax per tender id, summing to exactly `saleTaxCents` (or to the tenders' total if that is
 * smaller — see the clamp below).
 *
 * **The whole tax goes on the fiat legs, not a share proportional to them.** A customer settling a
 * $108 sale with $50 of RCN and $58 of card leaves the shop owing the state all $8: the RCN leg is a
 * discount, not a contribution to the tax. Scaling the tax down to the fiat share would report
 * $53.70 of revenue on a sale that earned the shop $50.
 *
 * Clamped to the tenders' total so revenue can never go negative. That only happens when RCN covers
 * more than the pre-tax value of the goods, which is pathological rather than impossible; reporting
 * zero revenue is defensible, reporting negative revenue is not.
 */
export function apportionTax(
  saleTaxCents: number,
  tenders: ApportionableTender[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (!tenders.length) return result;

  const total = tenders.reduce((sum, t) => sum + t.amountCents, 0);
  const tax = Math.max(0, Math.min(saleTaxCents, total));
  if (tax === 0 || total <= 0) {
    for (const t of tenders) result.set(t.id, 0);
    return result;
  }

  let allocated = 0;
  for (const t of tenders) {
    const share = Math.floor((tax * t.amountCents) / total);
    result.set(t.id, share);
    allocated += share;
  }

  // Floor leaves a remainder of at most (tenders - 1) cents. It goes on the largest leg, where it is
  // the smallest relative distortion — and on a single-tender sale that leg gets the exact figure.
  const remainder = tax - allocated;
  if (remainder > 0) {
    const largest = tenders.reduce((a, b) =>
      b.amountCents > a.amountCents ? b : a
    );
    result.set(largest.id, (result.get(largest.id) ?? 0) + remainder);
  }

  return result;
}
