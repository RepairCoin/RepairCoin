import { SubscriptionFeature } from "../types";
export { THEME_COLORS as PROFILE_COLORS } from "@/shared/constants/Colors";

export const SUBSCRIPTION_PRICE = 500;
export const SUBSCRIPTION_PERIOD = "month";
export const INITIAL_CHAT_MESSAGE = "Hi, I'm interested in your services.";

export const SUBSCRIPTION_FEATURES: SubscriptionFeature[] = [
  { id: "1", label: "Unlimited RCN purchases" },
  { id: "2", label: "Issue rewards to customers" },
  { id: "3", label: "Process redemptions" },
  { id: "4", label: "Customer management tools" },
  { id: "5", label: "Analytics dashboard" },
];

export const SHOP_PROFILE_TABS: import("../types").ProfileTab[] = [
  { key: "services", label: "Services" },
  { key: "details", label: "Details" },
];