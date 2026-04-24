import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useSettingsMutations } from "../mutations";
import { bugReportApi } from "../../services/bugReport.services";
import type { SettingsRole, SettingsConfig } from "../../types";

export type { SettingsRole, SettingsConfig } from "../../types";

export function useSettings(role: SettingsRole) {
  const { account } = useAuthStore();
  const { performLogout } = useSettingsMutations();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBugReportVisible, setIsBugReportVisible] = useState(false);

  // Format wallet address for display
  const walletDisplay = account?.address
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
    : "Not connected";

  // Common handlers
  const handleBack = useCallback(() => {
    goBack();
  }, []);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await performLogout();
    } catch (error) {
      console.error("[Logout] Error during logout:", error);
      router.replace("/onboarding1");
    } finally {
      setIsLoggingOut(false);
    }
  }, [performLogout, isLoggingOut]);

  const handleHelp = useCallback(() => {
    // TODO: Implement help screen
  }, []);

  const handleTerms = useCallback(() => {
    // TODO: Implement terms screen
  }, []);

  const handleOpenBugReport = useCallback(() => {
    setIsBugReportVisible(true);
  }, []);

  const handleCloseBugReport = useCallback(() => {
    setIsBugReportVisible(false);
  }, []);

  const handleSubmitBugReport = useCallback(
    async (report: { category: string; title: string; description: string }) => {
      try {
        await bugReportApi.submit(report);
        setIsBugReportVisible(false);
        Alert.alert(
          "Report Submitted",
          "Thank you for your feedback! We'll look into this issue.",
          [{ text: "OK" }]
        );
      } catch (error) {
        Alert.alert(
          "Submission Failed",
          "Unable to submit your report. Please try again later.",
          [{ text: "OK" }]
        );
        throw error;
      }
    },
    []
  );

  // Role-specific configuration
  const config: SettingsConfig =
    role === "customer"
      ? {
          editProfile: {
            icon: "person-outline",
            subtitle: "Update your personal information",
            route: "/customer/profile/edit-profile",
          },
          notificationPreferencesRoute: "/customer/notification/preferences",
          roleSpecificHandlers: {
            handleReferFriends: () => router.push("/customer/referral"),
          },
        }
      : {
          editProfile: {
            icon: "storefront-outline",
            subtitle: "Update your shop information",
            route: "/shop/profile/edit-profile",
          },
          notificationPreferencesRoute: "/shop/notification/preferences",
          roleSpecificHandlers: {
            handleSubscription: () => router.push("/shop/subscription"),
            handleBuyTokens: () => router.push("/shop/buy-token"),
            handleRedeemTokens: () => router.push("/shop/redeem-token"),
            handleGroups: () => router.push("/shop/groups" as any),
          },
        };

  const handleEditProfile = useCallback(() => {
    router.push(config.editProfile.route as any);
  }, [config.editProfile.route]);

  const handleNotificationPreferences = useCallback(() => {
    router.push(config.notificationPreferencesRoute as any);
  }, [config.notificationPreferencesRoute]);

  return {
    // UI state
    walletDisplay,
    isLoggingOut,
    isBugReportVisible,
    role,
    config,
    // Common handlers
    handleBack,
    handleLogout,
    handleEditProfile,
    handleNotificationPreferences,
    handleHelp,
    handleTerms,
    // Bug report handlers
    handleOpenBugReport,
    handleCloseBugReport,
    handleSubmitBugReport,
    // Role-specific handlers
    ...config.roleSpecificHandlers,
  };
}
