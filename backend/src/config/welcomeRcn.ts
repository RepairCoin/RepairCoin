// backend/src/config/welcomeRcn.ts
//
// Config for the "Welcome RCN on claim" hook — the one-time RCN reward granted
// when an imported/migrated customer claims their account (Square→FixFlow
// win-back conversion incentive).
//
// Decisions (docs/tasks/strategy/customer-migration/welcome-rcn-on-claim-scope.md):
//   - Whole feature behind ENABLE_WELCOME_RCN (default OFF) for safe rollout.
//   - Off-chain credit only — no on-chain mint in the claim path.
//   - Shop-funded, opt-in (per-shop shops.welcome_rcn_enabled / welcome_rcn_amount).
//   - Global default amount when a shop has no override: WELCOME_RCN_DEFAULT_AMOUNT (25 RCN).

/** Master kill-switch. When false, the claim flow never grants welcome RCN. */
export function isWelcomeRcnEnabled(): boolean {
  return process.env.ENABLE_WELCOME_RCN === 'true';
}

/** Fallback amount (RCN) when a shop has not set its own welcome_rcn_amount. */
const DEFAULT_WELCOME_RCN_AMOUNT = 25;

/**
 * Resolve the welcome amount for a grant. A shop override (non-null, > 0) wins;
 * otherwise the global default from WELCOME_RCN_DEFAULT_AMOUNT, else 25.
 * Returns 0 when nothing valid resolves — callers MUST skip the grant on <= 0.
 */
export function resolveWelcomeRcnAmount(shopAmount?: number | null): number {
  if (typeof shopAmount === 'number' && shopAmount > 0) {
    return shopAmount;
  }
  const envRaw = process.env.WELCOME_RCN_DEFAULT_AMOUNT;
  const envAmount = envRaw != null ? Number(envRaw) : NaN;
  if (Number.isFinite(envAmount) && envAmount > 0) {
    return envAmount;
  }
  return DEFAULT_WELCOME_RCN_AMOUNT;
}
