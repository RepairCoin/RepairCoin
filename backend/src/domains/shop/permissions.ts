// Shop Team Management — permission taxonomy & role templates (single source of truth).
// See docs/TEAM_MANAGEMENT_PLAN.md §4. Mirrors the platform-admin model: each team
// member carries a string[] of permissions, where '*' grants everything.

/** Every shop-scoped permission string the system understands. */
export const SHOP_PERMISSIONS = [
  'inventory:view',    // View inventory items, stock, adjustments
  'inventory:manage',  // Create/edit/delete items, adjust stock
  'pos:view',          // View purchase orders
  'pos:manage',        // Create/receive/cancel purchase orders
  'services:manage',   // Create/edit/delete marketplace services
  'bookings:view',     // View appointments/orders
  'bookings:manage',   // Complete/cancel/modify bookings
  'rewards:issue',     // Issue RCN rewards to customers
  'rewards:redeem',    // Process redemptions
  'customers:view',    // Customer lookup
  'analytics:view',    // Shop analytics dashboards
  'billing:manage',    // Subscription, RCN purchases, payment methods
  'team:manage',       // Invite/edit/remove team members
  'shop:manage',       // Shop profile, location, settings, integrations
  'marketing:manage',  // Marketing campaigns and ads
] as const;

export type ShopPermission = (typeof SHOP_PERMISSIONS)[number];

/** Wildcard grant — an owner (or admin) has every permission. */
export const ALL_PERMISSIONS = '*';

/**
 * Seed defaults per role. Still overridable per member ('custom' = exactly what the
 * owner checks off, so it has no fixed template).
 */
export const ROLE_TEMPLATES: Record<string, string[]> = {
  owner: [ALL_PERMISSIONS],
  manager: SHOP_PERMISSIONS.filter(
    (p) => p !== 'billing:manage' && p !== 'team:manage'
  ),
  staff: [
    'inventory:view',
    'bookings:view',
    'bookings:manage',
    'rewards:issue',
    'rewards:redeem',
    'customers:view',
  ],
};

/** Resolve the effective permission list for a role, or [] for unknown/custom roles. */
export function permissionsForRole(role: string): string[] {
  return ROLE_TEMPLATES[role] ?? [];
}

/** True if a permission set satisfies the required permission (wildcard-aware). */
export function hasPermission(permissions: string[] | undefined, required: string): boolean {
  if (!permissions) return false;
  return permissions.includes(ALL_PERMISSIONS) || permissions.includes(required);
}

/** Keep only recognized permission strings (defensive against bad input). */
export function sanitizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  const valid = new Set<string>([ALL_PERMISSIONS, ...SHOP_PERMISSIONS]);
  return permissions.filter((p): p is string => typeof p === 'string' && valid.has(p));
}
