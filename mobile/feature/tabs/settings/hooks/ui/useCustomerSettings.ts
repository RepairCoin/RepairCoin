import { useCallback } from "react";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/shared/store/auth.store";
import { useAuth } from "@/shared/hooks/auth/useAuth";
import { useTheme } from "@/shared/hooks/theme/useTheme";

export function useCustomerSettings() {
  const { account } = useAuthStore();
  const { useLogout } = useAuth();
  const { logout, isLoggingOut } = useLogout();
  const { useThemeColor } = useTheme();
  const { toggleColorScheme, isDarkMode } = useThemeColor();

  const walletDisplay = account?.address
    ? account.address.slice(0, 6) + "..." + account.address.slice(-4)
    : "Not connected";

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleBack = useCallback(() => {
    goBack();
  }, []);

  const handleEditProfile = useCallback(() => {
    router.push("/customer/profile/edit-profile");
  }, []);

  const handleReferFriends = useCallback(() => {
    router.push("/customer/referral");
  }, []);

  const handleHelp = useCallback(() => {
    // TODO: Implement help screen
  }, []);

  const handleTerms = useCallback(() => {
    // TODO: Implement terms screen
  }, []);

  return {
    walletDisplay,
    isDarkMode,
    isLoggingOut,
    handleToggleTheme: toggleColorScheme,
    handleLogout,
    handleBack,
    handleEditProfile,
    handleReferFriends,
    handleHelp,
    handleTerms,
  };
}
