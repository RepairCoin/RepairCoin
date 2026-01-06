import { useAuthStore } from "@/store/auth.store";

export function useBuyTokenQueries() {
  const { userProfile } = useAuthStore();

  // Check if shop is qualified to buy RCN
  const isQualified =
    userProfile?.operational_status === "subscription_qualified" ||
    userProfile?.operational_status === "rcg_qualified";

  return {
    shopData: userProfile,
    isQualified,
  };
}
