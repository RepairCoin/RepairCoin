import { RepairOption, HowItWorksItem, CustomerTier } from "../types";

export const TIER_STYLES: Record<CustomerTier, string> = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600",
};

export const REPAIR_OPTIONS: RepairOption[] = [
  {
    type: "minor",
    label: "XS Repair",
    rcn: 5,
    description: "$30 - $50 repair value",
  },
  {
    type: "small",
    label: "Small Repair",
    rcn: 10,
    description: "$50 - $99 repair value",
  },
  {
    type: "large",
    label: "Large Repair",
    rcn: 15,
    description: "$100+ repair value",
  },
];

export const HOW_IT_WORKS_ITEMS: HowItWorksItem[] = [
  {
    icon: "person-search",
    title: "Find Customer",
    desc: "Enter customer's wallet address to check their tier",
  },
  {
    icon: "build",
    title: "Select Repair",
    desc: "Choose repair type or enter custom amount and RCN",
  },
  {
    icon: "star",
    title: "Tier Bonuses",
    desc: "Silver +2 RCN, Gold +5 RCN automatically added",
  },
  {
    icon: "local-offer",
    title: "Apply Promo",
    desc: "Optional promo codes for additional bonuses",
  },
  {
    icon: "send",
    title: "Instant Transfer",
    desc: "RCN tokens transferred directly to customer's wallet",
  },
];
