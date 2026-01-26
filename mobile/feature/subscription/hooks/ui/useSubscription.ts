import { useAuthStore } from "@/shared/store/auth.store";
import { useShop } from "@/shared/hooks/shop/useShop";
import { goBack } from "expo-router/build/global-state/routing";

export function useSubscription() {
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();
  const { data: shopData } = useGetShopByWalletAddress(account?.address || "");

  const isSubscribed = shopData?.operational_status === "subscription_qualified";

  const handleSubscribe = () => {
    // TODO: Implement Stripe subscription
  };

  const handleCancelSubscription = () => {
    // TODO: Implement cancel subscription
  };

  const handleGoBack = () => {
    goBack();
  };

  return {
    isSubscribed,
    shopData,
    handleSubscribe,
    handleCancelSubscription,
    handleGoBack,
  };
}
