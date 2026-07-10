import { ProfileTab } from "@/feature/shop/services/shop.interface";
export { THEME_COLORS as PROFILE_COLORS } from "@/shared/constants/Colors";

export const SUBSCRIPTION_PERIOD = "month";
export const INITIAL_CHAT_MESSAGE = "Hi, I'm interested in your services.";

export const SHOP_PROFILE_TABS: ProfileTab[] = [
  { key: "services", label: "Services" },
  { key: "details", label: "Details" },
];
