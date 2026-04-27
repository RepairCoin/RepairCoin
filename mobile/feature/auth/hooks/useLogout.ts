import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import * as SecureStore from "expo-secure-store";
import apiClient from "@/shared/utilities/axios";
import { notificationApi } from "@/feature/notification/services/notification.services";

const SECURE_STORE_KEYS = [
  "auth-store",
  "repairCoin_authData",
  "repairCoin_authToken",
  "repairCoin_userType",
  "repairCoin_walletAddress",
  "payment-session-storage",
];

export const useLogout = () => {
  const queryClient = useQueryClient();
  const account = useAuthStore((state) => state.account);
  const resetState = useAuthStore((state) => state.resetState);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async (navigate = true) => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);

      // Clear axios auth header
      apiClient.clearAuthHeader();

      // Deactivate push tokens (fire and forget)
      notificationApi.deactivateAllPushTokens().catch((error) => {
        console.error("[Logout] Error deactivating push tokens:", error);
      });

      // Disconnect wallet if connected
      if (account?.disconnect) {
        try {
          await account.disconnect();
        } catch (error) {
          console.error("[Logout] Error disconnecting wallet:", error);
        }
      }

      // Clear SecureStore
      try {
        await Promise.all(
          SECURE_STORE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
        );
      } catch (error) {
        console.error("[Logout] Error clearing SecureStore:", error);
      }

      // Clear React Query cache
      queryClient.clear();
      await queryClient.cancelQueries();
      queryClient.removeQueries();

      // Reset Zustand state
      resetState();

      if (navigate) {
        router.replace("/onboarding1");
      }
    } catch (error) {
      console.error("[Logout] Error during logout:", error);
      router.replace("/onboarding1");
    } finally {
      setIsLoggingOut(false);
    }
  }, [queryClient, account, resetState, isLoggingOut]);

  return {
    logout: handleLogout,
    isLoggingOut,
  };
};
