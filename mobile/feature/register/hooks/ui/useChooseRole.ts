import { useCallback } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";

export const useChooseRole = () => {
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/onboarding1");
  }, [logout]);

  const handleCustomerPress = useCallback(() => {
    router.push("/register/customer");
  }, []);

  const handleShopPress = useCallback(() => {
    router.push("/register/shop");
  }, []);

  return {
    handleLogout,
    handleCustomerPress,
    handleShopPress,
  };
};
