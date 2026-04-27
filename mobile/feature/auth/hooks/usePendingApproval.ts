import { useCallback } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useLogout } from "./useLogout";

export const usePendingApproval = () => {
  const { logout } = useLogout();
  const userProfile = useAuthStore((state) => state.userProfile);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    const checkStoredAuth = useAuthStore.getState().checkStoredAuth;
    await checkStoredAuth();

    const isActive = useAuthStore.getState().userProfile?.isActive;
    if (isActive) {
      router.replace("/shop/tabs/home");
    }
  }, []);

  return {
    userProfile,
    handleLogout,
    handleRefresh,
  };
};
