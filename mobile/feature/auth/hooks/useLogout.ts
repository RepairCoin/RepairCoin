import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";
import { useCallback, useState } from "react";

export const useLogout = () => {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      queryClient.clear();
      await queryClient.cancelQueries();
      queryClient.removeQueries();
      queryClient.resetQueries();
      await logout(true);
    } catch (error) {
      console.error("[Logout] Error during logout:", error);
      router.replace("/onboarding1");
    } finally {
      setIsLoggingOut(false);
    }
  }, [queryClient, logout, isLoggingOut]);

  return {
    logout: handleLogout,
    isLoggingOut,
  };
};
