import { CustomerTierLower } from "@/feature/customer/profile/services/customer.interface";
export { THEME_COLORS as PROFILE_COLORS } from "@/shared/constants/Colors";

export const TIER_COLORS: Record<CustomerTierLower, string> = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
};

export const DEFAULT_TIER: CustomerTierLower = "bronze";

export const AVATAR_SIZE = {
  small: 48,
  medium: 80,
  large: 120,
} as const;

export const INITIAL_CHAT_MESSAGE = "Hi, I'm interested in your services.";
