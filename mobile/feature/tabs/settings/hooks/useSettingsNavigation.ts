import { useCallback } from "react";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";

export function useSettingsNavigation() {
  const handleBack = useCallback(() => {
    goBack();
  }, []);

  const handleEditProfile = useCallback(() => {
    router.push("/shop/profile/edit-profile");
  }, []);

  const handleSubscription = useCallback(() => {
    router.push("/shop/subscription");
  }, []);

  const handleBuyTokens = useCallback(() => {
    router.push("/shop/buy-token");
  }, []);

  const handleRedeemTokens = useCallback(() => {
    router.push("/shop/redeem-token");
  }, []);

  const handleHelp = useCallback(() => {
    // TODO: Implement help screen
  }, []);

  const handleTerms = useCallback(() => {
    // TODO: Implement terms screen
  }, []);

  return {
    handleBack,
    handleEditProfile,
    handleSubscription,
    handleBuyTokens,
    handleRedeemTokens,
    handleHelp,
    handleTerms,
  };
}
