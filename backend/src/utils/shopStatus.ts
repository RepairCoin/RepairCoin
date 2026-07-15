/**
 * Shop lifecycle status — single source of truth.
 *
 * Shops are auto-active on signup — there is no admin-approval step, so there is no
 * "pending" state for new shops. Statuses:
 *   - suspended: admin suspended the shop (suspendedAt is set)
 *   - rejected:  deactivated (active=false without suspension)
 *   - active:    active, no suspension
 *
 * suspendedAt is the authoritative signal for true suspension — `active=false`
 * alone is NOT suspension (it means deactivated/rejected).
 *
 * 'pending' is retained in the type only for backwards compatibility with legacy
 * data/consumers; getShopStatus never returns it.
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
  if (shop.active === false) return 'rejected';
  return 'active';
}

export function isShopStatus(value: unknown): value is ShopStatus {
  return typeof value === 'string' && (SHOP_STATUSES as readonly string[]).includes(value);
}
