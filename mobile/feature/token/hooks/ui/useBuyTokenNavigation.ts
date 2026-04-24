import { useCallback } from "react";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";

export function useBuyTokenNavigation() {
  const navigateBack = useCallback(() => {
    goBack();
  }, []);

  const navigateToSubscriptionForm = useCallback(() => {
    router.push("/shop/subscription-form");
  }, []);

  return {
    navigateBack,
    navigateToSubscriptionForm,
  };
}
