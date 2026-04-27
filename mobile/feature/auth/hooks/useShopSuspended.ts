import { useCallback, useState } from "react";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { authApi } from "@/feature/auth/services/auth.services";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useLogout } from "./useLogout";

export const useShopSuspended = () => {
  const { showSuccess, showError } = useAppToast();
  const userProfile = useAuthStore((state) => state.userProfile);
  const account = useAuthStore((state) => state.account);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const { logout } = useLogout();
  const [isChecking, setIsChecking] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleCheckStatus = useCallback(async () => {
    if (isChecking) return;
    const address = userProfile?.walletAddress || userProfile?.address || account?.address;
    if (!address) {
      showError("Missing wallet address. Please log out and try again.");
      return;
    }

    try {
      setIsChecking(true);
      const result = await authApi.checkUserExists(address);
      if (result?.type !== "shop" || !result?.user) {
        showError("Unable to verify shop status. Please try again.");
        return;
      }

      const latest = result.user;
      const isActive = latest.isActive ?? latest.active;
      const stillSuspended =
        latest.suspendedAt || (latest.verified && !isActive);

      setUserProfile(latest);

      if (!stillSuspended && isActive && latest.verified) {
        showSuccess("Your shop has been reactivated.");
        router.replace("/shop/tabs/home");
      } else {
        showSuccess("Status checked — your shop is still suspended.");
      }
    } catch (error) {
      console.error("[useShopSuspended] Status check failed:", error);
      showError("Unable to check status. Please try again.");
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, userProfile, setUserProfile, showSuccess, showError]);

  return {
    userProfile,
    isChecking,
    handleLogout,
    handleCheckStatus,
  };
};
