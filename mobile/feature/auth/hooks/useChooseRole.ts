import { useCallback } from "react";
import { router } from "expo-router";
import { useLogout } from "./useLogout";

export const useChooseRole = () => {
  const { logout } = useLogout();

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleCustomerPress = useCallback(() => {
    router.push("/register/customer");
  }, []);

  const handleShopPress = useCallback(() => {
    router.push("/register/shop");
  }, []);

  return {
    handleCustomerPress,
    handleShopPress,
    handleLogout,
  };
};
