// Maps shop dashboard tabs to the permission required to view them. Tabs not listed
// here are always visible (overview, support, settings, logout). Kept in sync with the
// backend taxonomy in backend/src/domains/shop/permissions.ts.
export const SHOP_TAB_PERMISSIONS: Record<string, string> = {
  services: "services:manage",
  inventory: "inventory:view",
  "purchase-orders": "pos:view",
  bookings: "bookings:view",
  appointments: "bookings:view",
  disputes: "bookings:view",
  "service-analytics": "analytics:view",
  tools: "rewards:issue",
  customers: "customers:view",
  messages: "customers:view",
  profile: "shop:manage",
  "shop-location": "shop:manage",
  marketing: "marketing:manage",
  team: "team:manage",
  reports: "analytics:view",
  purchase: "billing:manage",
  staking: "billing:manage",
  plans: "billing:manage",
  "wallet-payouts": "billing:manage",
};
