import { useCallback } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useLogout } from "./useLogout";
import { useCheckStoredAuth } from "./useCheckStoredAuth";

export const usePendingApproval = () => {
  const { logout } = useLogout();
  const { checkStoredAuth } = useCheckStoredAuth();
  const userProfile = useAuthStore((state) => state.userProfile);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    await checkStoredAuth();

    const isActive = useAuthStore.getState().userProfile?.isActive;
    if (isActive) {
      router.replace("/shop/tabs/home");
    }
  }, [checkStoredAuth]);

  return {
    userProfile,
    handleLogout,
    handleRefresh,
  };
};
