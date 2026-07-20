// Add-on catalog for the shop "Plans & Billing" hub.
//
// The hub renders one card per entry here — adding an add-on is a one-line append,
// the hub code never changes (see docs/tasks/strategy/pricing-alignment/addon-access-design.md).
// Per-shop STATUS is resolved at runtime in services/api/addons.ts, kept out of this
// static config so the registry stays declarative. An add-on whose backend isn't built
// yet resolves to 'coming_soon' and renders as a disabled card.

export type AddonActivation =
  | 'toggle'       // instant in-app toggle
  | 'request'      // request → admin approves
  | 'onboarding'   // external onboarding flow (e.g. Stripe Connect)
  | 'checkout'     // in-hub Stripe checkout (redirect to pay, provisioned on webhook)
  | 'contact'      // sales-assisted
  | 'coming_soon'; // placeholder until built

export type AddonCategory = 'marketing' | 'payments' | 'ai' | 'agency';

export interface AddonDef {
  id: string;
  displayName: string;
  description: string;
  priceLabel: string;
  category: AddonCategory;
  activationType: AddonActivation;
  /** Deep-link into the feature that owns this add-on's config (a ?tab= route). */
  manageLink?: string;
  /** Button label when the add-on is OFF and can be activated. */
  ctaLabel: string;
  /** Optional env flag to reveal the card during rollout. */
  featureFlag?: string;
}

export const ADDON_REGISTRY: AddonDef[] = [
  {
    id: 'ai_ads',
    displayName: 'AI Ads Management',
    description: 'FixFlow runs your Meta & Google ads and an AI answers every lead automatically. Lead replies are included — they don’t use your AI allowance.',
    priceLabel: '$199–$999/mo',
    category: 'marketing',
    activationType: 'request',
    manageLink: '/shop?tab=ads',
    ctaLabel: 'Request ads',
  },
  {
    id: 'payments',
    displayName: 'Payments Processing',
    description: 'Accept card payments for bookings with a low per-transaction fee.',
    priceLabel: '0.5–1% / transaction',
    category: 'payments',
    activationType: 'onboarding',
    manageLink: '/shop?tab=wallet-payouts',
    ctaLabel: 'Connect Stripe',
  },
  {
    id: 'ai_overage',
    displayName: 'AI Usage Overage',
    description: 'Keep your AI assistant, insights, marketing & customer auto-replies running past your monthly allowance, billed as you grow. (Ad-lead replies are covered by AI Ads Management.)',
    priceLabel: 'Usage ×3',
    category: 'ai',
    activationType: 'toggle',
    manageLink: '/shop?tab=settings',
    ctaLabel: 'Enable',
  },
  {
    id: 'agency',
    displayName: 'Agency Program',
    description: 'Manage multiple shop accounts under one roof with a single dashboard.',
    priceLabel: '$999/mo · up to 10 clients',
    category: 'agency',
    activationType: 'checkout',
    manageLink: '/shop?tab=agency',
    ctaLabel: 'Activate — $999/mo',
  },
];
