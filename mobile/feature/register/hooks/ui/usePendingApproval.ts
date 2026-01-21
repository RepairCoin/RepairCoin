import { useCallback } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/store/auth.store";

export const usePendingApproval = () => {
  const logout = useAuthStore((state) => state.logout);
  const userProfile = useAuthStore((state) => state.userProfile);

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/onboarding1");
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
