import { Tier } from "@/utilities/GlobalTypes";
import { TierConfig } from "../types";

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  BRONZE: {
    color: ["#95602B", "#D4A574"],
    label: "Bronze",
    bonus: 0,
    requirement: 0,
    benefits: [
      "Earn RCN on every repair",
      "20% redemption at any shop",
      "100% redemption at earning shop",
      "Access to service marketplace",
    ],
  },
  SILVER: {
    color: ["#ABABAB", "#E8E8E8"],
    label: "Silver",
    bonus: 2,
    requirement: 200,
    benefits: [
      "All Bronze benefits",
      "+2 RCN bonus on every reward",
      "Priority customer support",
      "Early access to promotions",
    ],
  },
  GOLD: {
    color: ["#FFCC00", "#FFE566"],
    label: "Gold",
    bonus: 5,
    requirement: 1000,
    benefits: [
      "All Silver benefits",
      "+5 RCN bonus on every reward",
      "Exclusive Gold member deals",
      "VIP customer support",
      "Special event invitations",
    ],
  },
};

export const TIER_ORDER: Tier[] = ["BRONZE", "SILVER", "GOLD"];
