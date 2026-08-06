/**
 * Warranty cover is a term plus the day the work was delivered — see migration 266 for why no
 * expiry is stored. Everything that shows cover derives it here, so a receipt, a register panel and
 * a claim check can never disagree about when a promise runs out.
 */

export function warrantyExpiry(
  completedAt: Date | string | null | undefined,
  warrantyDays: number | null | undefined
): Date | null {
  if (!completedAt || !warrantyDays || warrantyDays <= 0) return null;
  const start = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + warrantyDays * 86_400_000);
}

/**
 * Whole days of cover left, rounded up so the final day reads as 1 rather than 0 — a customer told
 * "expires today" is still covered today, and a register that shows 0 invites the shop to refuse a
 * claim it still owes. Never negative: expired is expired, not "-3 days left".
 */
export function daysRemaining(expiry: Date | string, now: Date = new Date()): number {
  const end = expiry instanceof Date ? expiry : new Date(expiry);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(Math.ceil((end.getTime() - now.getTime()) / 86_400_000), 0);
}

/**
 * "90-day warranty — covered to Nov 4, 2026". Returns null when nothing was promised, so callers
 * render nothing rather than "0-day warranty", which reads as a broken feature instead of no cover.
 */
export function warrantyLabel(
  completedAt: Date | string | null | undefined,
  warrantyDays: number | null | undefined
): string | null {
  const expiry = warrantyExpiry(completedAt, warrantyDays);
  if (!expiry) return null;
  const covered = expiry.toLocaleDateString('en-US', { dateStyle: 'medium' });
  return `${warrantyDays}-day warranty — covered to ${covered}`;
}
