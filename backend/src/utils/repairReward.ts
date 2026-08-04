/**
 * How much RCN a purchase earns. Extracted so the counter and the manual issue-reward route
 * cannot drift: the amounts step at fixed thresholds, so any divergence would silently pay two
 * customers differently for the same spend.
 */

/** Stepped, not proportional — under $30 earns no base reward at all. */
export function calculateBaseReward(amountUsd: number): number {
  if (!Number.isFinite(amountUsd)) return 0;
  if (amountUsd >= 100) return 15;
  if (amountUsd >= 50) return 10;
  if (amountUsd >= 30) return 5;
  return 0;
}

export function calculateTierBonus(tier: string | null | undefined): number {
  switch ((tier || '').toUpperCase()) {
    case 'SILVER':
      return 2;
    case 'GOLD':
      return 5;
    default:
      return 0;
  }
}

/**
 * Base plus tier bonus, composed exactly as the manual issue-reward route composes them.
 *
 * Note the tier bonus does NOT depend on the base: a Gold customer spending $10 earns 5 RCN even
 * though the amount is below the $30 base threshold. That is existing platform behaviour rather
 * than an intended rule, and the counter matches it deliberately — the same spend must not earn
 * differently depending on which screen rang it up.
 */
export function calculateReward(
  amountUsd: number,
  tier: string | null | undefined
): { baseReward: number; tierBonus: number; total: number } {
  const baseReward = calculateBaseReward(amountUsd);
  const tierBonus = calculateTierBonus(tier);
  return { baseReward, tierBonus, total: baseReward + tierBonus };
}
