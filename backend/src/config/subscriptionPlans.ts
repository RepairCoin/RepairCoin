// Tiers a shop can actually BUY. 'free' is deliberately not one of them: it has no Stripe
// price, so it must never reach resolveCheckoutPriceId.
export type PaidTier = 'starter' | 'growth' | 'business';

// Every tier a shop can RESOLVE to at runtime. 'free' is the implicit tier for a shop with no
// active subscription — a fresh signup, or a trial that ended without converting. Nothing
// assigns it; getShopTier derives it from live subscription state (see utils/shopTier.ts).
export type SubscriptionTier = PaidTier | 'free';

export interface SubscriptionPlan {
  tier: PaidTier;
  label: string;
  amount: number;
  priceEnvKey: string;
}

export const SUBSCRIPTION_PLANS: Record<PaidTier, SubscriptionPlan> = {
  starter: { tier: 'starter', label: 'Starter AI', amount: 80, priceEnvKey: 'STRIPE_PRICE_STARTER' },
  growth: { tier: 'growth', label: 'Growth AI', amount: 299, priceEnvKey: 'STRIPE_PRICE_GROWTH' },
  business: { tier: 'business', label: 'Business AI', amount: 599, priceEnvKey: 'STRIPE_PRICE_BUSINESS' },
};

export const FREE_TIER_LABEL = 'Free';

export const DEFAULT_TIER: PaidTier = 'business';

// Monthly AI-usage allowance (raw AI cost, USD) INCLUDED per tier — the unit
// ai_shop_settings.current_month_spend_usd measures. Pricing sheet: $10 / $30 / $75.
// The AI budget is a pure function of the tier (never hand-set by an admin); the
// enforcer computes it from the shop's current tier at read time.
export const AI_TIER_ALLOWANCE: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 10,
  growth: 30,
  business: 75,
};

export const LEGACY_MONTHLY_AMOUNT = 500;

export const TRIAL_PERIOD_DAYS = 14;

// Guards a REQUESTED tier (checkout, trial start, admin plan change). Intentionally rejects
// 'free' — free is never something a shop selects, only something it falls back to.
export function isValidTier(value: unknown): value is PaidTier {
  return value === 'starter' || value === 'growth' || value === 'business';
}

export function getPlanByTier(tier: PaidTier): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[tier];
}

export function resolveCheckoutPriceId(tier: SubscriptionTier): string {
  const plan = SUBSCRIPTION_PLANS[tier];
  const tierPriceId = process.env[plan.priceEnvKey];
  if (tierPriceId) {
    return tierPriceId;
  }
  const legacyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (legacyPriceId) {
    return legacyPriceId;
  }
  throw new Error(
    `No Stripe price configured for tier "${tier}" (set ${plan.priceEnvKey} or STRIPE_MONTHLY_PRICE_ID)`
  );
}

export function getPlanByPriceId(
  priceId: string | null | undefined
): (SubscriptionPlan & { legacy?: boolean }) | undefined {
  if (!priceId) {
    return undefined;
  }
  for (const plan of Object.values(SUBSCRIPTION_PLANS)) {
    if (process.env[plan.priceEnvKey] && process.env[plan.priceEnvKey] === priceId) {
      return plan;
    }
  }
  if (process.env.STRIPE_MONTHLY_PRICE_ID && process.env.STRIPE_MONTHLY_PRICE_ID === priceId) {
    return { ...SUBSCRIPTION_PLANS[DEFAULT_TIER], amount: LEGACY_MONTHLY_AMOUNT, legacy: true };
  }
  return undefined;
}

export function getMonthlyAmountForPriceId(priceId: string | null | undefined): number {
  return getPlanByPriceId(priceId)?.amount ?? 0;
}

// Agency Program (add-on) — a flat $999/mo base plan billed on its own Stripe price,
// separate from the shop subscription tiers above. Per-extra-client metering ($50/client
// beyond the client_limit) lands in a later slice; only the base is wired here.
export const AGENCY_BASE_AMOUNT = 999;
export const AGENCY_EXTRA_CLIENT_AMOUNT = 50;

export function resolveAgencyBasePriceId(): string {
  const priceId = process.env.STRIPE_PRICE_AGENCY_BASE;
  if (!priceId) {
    throw new Error(
      'No Stripe price configured for the Agency Program (set STRIPE_PRICE_AGENCY_BASE)'
    );
  }
  return priceId;
}

export function getAgencyExtraClientPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_AGENCY_EXTRA_CLIENT || undefined;
}
