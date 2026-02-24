import { useState, useCallback } from "react";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useAuthStore } from "@/shared/store/auth.store";
import { useSettingsMutations } from "../mutations";

export type SettingsRole = "customer" | "shop";

export interface SettingsConfig {
  editProfile: {
    icon: "person-outline" | "storefront-outline";
    subtitle: string;
    route: string;
  };
  roleSpecificHandlers: {
    // Customer-specific
    handleReferFriends?: () => void;
    // Shop-specific
    handleSubscription?: () => void;
    handleBuyTokens?: () => void;
    handleRedeemTokens?: () => void;
    handleGroups?: () => void;
  };
}

export function useSettings(role: SettingsRole) {
  const { account } = useAuthStore();
  const { performLogout } = useSettingsMutations();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  // Role-specific configuration
  const config: SettingsConfig =
    role === "customer"
      ? {
          editProfile: {
            icon: "person-outline",
            subtitle: "Update your personal information",
            route: "/customer/profile/edit-profile",
          },
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

  return {
    // UI state
    walletDisplay,
    isLoggingOut,
    role,
    config,
    // Common handlers
    handleBack,
    handleLogout,
    handleEditProfile,
    handleHelp,
    handleTerms,
    // Role-specific handlers
    ...config.roleSpecificHandlers,
  };
}
