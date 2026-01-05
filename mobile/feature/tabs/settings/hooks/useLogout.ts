import { useCallback, useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";

export function useLogout() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      console.log("[Logout] Starting logout process...");

      // 1. Clear all React Query cache
      console.log("[Logout] Clearing React Query cache...");
      queryClient.clear();

      // 2. Cancel any pending queries
      await queryClient.cancelQueries();

      // 3. Remove all queries from cache
      queryClient.removeQueries();

      // 4. Reset query client defaults
      queryClient.resetQueries();

      console.log("[Logout] React Query cache cleared");

      // 5. Call the Zustand logout which handles:
      //    - Wallet disconnection
      //    - Clearing axios auth token
      //    - Clearing SecureStore
      //    - Resetting Zustand state
      //    - Navigation to onboarding
      await logout(true);

      console.log("[Logout] Logout completed successfully");
    } catch (error) {
      console.error("[Logout] Error during logout:", error);
      // Still try to navigate even if there's an error
      router.replace("/onboarding1");
    } finally {
      setIsLoggingOut(false);
    }
  }, [queryClient, logout, isLoggingOut]);

  return {
    logout: handleLogout,
    isLoggingOut,
  };
}
