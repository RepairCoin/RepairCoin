import { useState, useCallback } from "react";
import { router } from "expo-router";
import { useSettingsMutations } from "../mutations";

export function useLogoutUI() {
  const { performLogout } = useSettingsMutations();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await performLogout();
    } catch (error) {
      console.error("[Logout] Error during logout:", error);
      // Still try to navigate even if there's an error
      router.replace("/onboarding1");
    } finally {
      setIsLoggingOut(false);
    }
  }, [performLogout, isLoggingOut]);

  return {
    handleLogout,
    isLoggingOut,
  };
}
