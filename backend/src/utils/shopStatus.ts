/**
 * Shop lifecycle status — single source of truth.
 *
 * Mirrors the admin UI convention (ShopsManagementTab.tsx):
 *   - suspended: admin suspended the shop (suspendedAt is set)
 *   - pending:   awaiting admin verification (verified=false)
 *   - rejected:  verified but inactive (active=false without suspension)
 *   - active:    verified and active, no suspension
 *
 * suspendedAt is the authoritative signal for true suspension — `active=false`
 * alone is NOT suspension (newly registered shops are verified=false/active=false
 * with suspendedAt=null, which is "pending", not "suspended").
 */

export type ShopStatus = 'active' | 'pending' | 'suspended' | 'rejected';

export const SHOP_STATUSES: readonly ShopStatus[] = [
  'active',
  'pending',
  'suspended',
  'rejected',
];

export interface ShopStatusInput {
  verified?: boolean | null;
  active?: boolean | null;
  suspendedAt?: string | Date | null;
}

export function getShopStatus(shop: ShopStatusInput): ShopStatus {
  if (shop.suspendedAt) return 'suspended';
  if (shop.verified === false) return 'pending';
  if (shop.active === false) return 'rejected';
  return 'active';
}

export function isShopStatus(value: unknown): value is ShopStatus {
  return typeof value === 'string' && (SHOP_STATUSES as readonly string[]).includes(value);
}
