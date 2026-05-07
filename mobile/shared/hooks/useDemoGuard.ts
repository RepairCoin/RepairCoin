import { useCallback } from "react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppToast } from "@/shared/hooks/useAppToast";

/**
 * Returns a guard function that blocks write actions in demo mode.
 * Call it before any write action; returns true if blocked.
 */
export function useDemoGuard() {
  const isDemo = useAuthStore((s) => s.isDemo);
  const { showError } = useAppToast();

  return useCallback(() => {
    if (isDemo) {
      showError("This action is not available in demo mode. Please sign in with a wallet.");
      return true;
    }
    return false;
  }, [isDemo, showError]);
}
