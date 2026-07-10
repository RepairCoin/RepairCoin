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

export const DEFAULT_TIER: SubscriptionTier = "growth";

export const TRIAL_PERIOD_DAYS = 14;

export function isValidTier(value: unknown): value is SubscriptionTier {
  return value === "starter" || value === "growth" || value === "business";
}

export function getPlanByTier(tier: SubscriptionTier): SubscriptionPlanInfo {
  return SUBSCRIPTION_PLANS.find((p) => p.tier === tier) ?? SUBSCRIPTION_PLANS[1];
}
