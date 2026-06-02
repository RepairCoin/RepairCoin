import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { authApi } from "@/feature/auth/services/auth.services";

const POLL_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Polls the shop's suspension status while the shop dashboard is active.
 * Redirects to the suspended screen immediately when a suspension is detected.
 */
export function useShopSuspensionGuard() {
  const userProfile = useAuthStore((s) => s.userProfile);
  const userType = useAuthStore((s) => s.userType);
  const account = useAuthStore((s) => s.account);
  const setUserProfile = useAuthStore((s) => s.setUserProfile);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (userType !== "shop") return;

    const address =
      userProfile?.walletAddress || userProfile?.address || account?.address;
    if (!address) return;

    const checkStatus = async () => {
      // Skip polling when the app is backgrounded
      if (AppState.currentState !== "active") return;

      try {
        const result = await authApi.checkUserExists(address);
        if (!result.exists || result.type !== "shop" || !result.user) return;

        const latest = result.user as Record<string, any>;
        const isActive = latest.isActive ?? latest.active;
        const isSuspended =
          !!latest.suspendedAt ||
          !!latest.suspended_at ||
          (latest.verified && !isActive);

        if (isSuspended) {
          setUserProfile(latest);
          router.replace("/register/suspended");
        }
      } catch {
        // Silently ignore – the next poll will retry
      }
    };

    timerRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userType, userProfile?.walletAddress, userProfile?.address, account?.address, setUserProfile]);
}
