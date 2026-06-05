import { useQueryClient } from "@tanstack/react-query";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
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
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const resetState = useAuthStore((state) => state.resetState);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async (navigate = true) => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      apiClient.clearAuthHeader();

      notificationApi.deactivateAllPushTokens().catch((error) => {
        console.error("[Logout] Error deactivating push tokens:", error);
      });

      // Disconnect the actual thirdweb wallet (not the store's plain
      // { address } object). This tears down the underlying WalletConnect
      // session and clears thirdweb's persisted "last connected wallet"
      // record, preventing a stale "No matching key. session:" error from
      // useAutoConnect on the next app launch.
      if (activeWallet) {
        try {
          await disconnect(activeWallet);
        } catch (error) {
          console.error("[Logout] Error disconnecting wallet:", error);
        }
      }

      try {
        await Promise.all(
          SECURE_STORE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
        );
      } catch (error) {
        console.error("[Logout] Error clearing SecureStore:", error);
      }

      queryClient.clear();
      await queryClient.cancelQueries();
      queryClient.removeQueries();
      resetState();

      if (navigate) {
        router.replace("/(auth)/connect");
      }
    } catch (error) {
      console.error("[Logout] Error during logout:", error);
      router.replace("/(auth)/connect");
    } finally {
      setIsLoggingOut(false);
    }
  }, [queryClient, activeWallet, disconnect, resetState, isLoggingOut]);

  return {
    logout: handleLogout,
    isLoggingOut,
  };
};
