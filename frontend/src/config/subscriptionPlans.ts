export type SubscriptionTier = "starter" | "growth" | "business";

export interface SubscriptionPlanInfo {
  tier: SubscriptionTier;
  label: string;
  price: number;
  popular?: boolean;
  includesLabel: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanInfo[] = [
  {
    tier: "starter",
    label: "Starter AI",
    price: 80,
    includesLabel: "Includes",
    features: [
      "Online Booking & Scheduling",
      "CRM & Customer Management",
      "Review Management",
      "AI Assistant (Basic)",
      "Branding Studio (Basic)",
      "Email & SMS Marketing (SMS)",
      "Mobile App",
      "Basic Reports",
    ],
  },
  {
    tier: "growth",
    label: "Growth AI",
    price: 299,
    popular: true,
    includesLabel: "Includes everything in Starter, plus:",
    features: [
      "AI Marketing Suite",
      "AI Image & Content Generator",
      "AI Lead Follow-Up (Email & SMS)",
      "AI Insights & Business Intelligence",
      "Inventory Management",
      "Voice AI Assistant",
      "Campaign Builder",
      "Advanced Reports & Analytics",
      "Priority Email Support",
    ],
  },
  {
    tier: "business",
    label: "Business AI",
    price: 599,
    includesLabel: "Includes everything in Growth, plus:",
    features: [
      "Multi-location Management",
      "Advanced AI Memory & Automation",
      "Team Management & Permissions",
      "AI Auto-Replies (Voice & Text)",
      "AI Campaigns (Advanced)",
      "Customer Workflows",
      "Advanced Inventory Intelligence",
      "Dedicated Account Manager",
      "Priority Phone & Chat Support",
    ],
  },
];

export const SUBSCRIBE_TIER_STORAGE_KEY = "rc_subscribe_tier";

export const DEFAULT_TIER: SubscriptionTier = "growth";

export const TRIAL_PERIOD_DAYS = 14;

// The retired single-plan price. Any subscription billed this amount is a
// grandfathered legacy subscriber (no current tier is priced at $500).
export const LEGACY_MONTHLY_AMOUNT = 500;

export function isValidTier(value: unknown): value is SubscriptionTier {
  return value === "starter" || value === "growth" || value === "business";
}

export function getPlanByTier(tier: SubscriptionTier): SubscriptionPlanInfo {
  return SUBSCRIPTION_PLANS.find((p) => p.tier === tier) ?? SUBSCRIPTION_PLANS[1];
}

export function resolvePlanLabel(input: {
  planLabel?: string | null;
  tier?: string | null;
  subscriptionType?: string | null;
  monthlyAmount?: number | null;
}): string {
  if (input.subscriptionType === "trial") return "Free Trial";
  if (input.monthlyAmount === LEGACY_MONTHLY_AMOUNT) return "Legacy";
  if (input.planLabel) return input.planLabel;
  if (input.tier && isValidTier(input.tier)) return getPlanByTier(input.tier).label;
  const t = input.subscriptionType;
  if (t) {
    return isValidTier(t)
      ? getPlanByTier(t).label
      : t.charAt(0).toUpperCase() + t.slice(1);
  }
  return "Subscription";
}
