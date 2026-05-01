import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppStore } from "@/shared/store/app.store";

export const useSplashNavigation = () => {
  const { 
    isAuthenticated,
    userProfile,
    userType,
    accessToken,
    hasHydrated,
    account,
    setAccount
  } = useAuthStore();
  const hasSeenOnboarding = useAppStore((state) => state.hasSeenOnboarding);

  const navigate = async () => {
    if (!hasHydrated) {
      return;
    }

    if (!hasSeenOnboarding) {
      router.replace("/(auth)/onboarding");
      return;
    }

    if (!isAuthenticated || !userProfile?.address || !accessToken || !account) {
      router.replace("/(auth)/connect");
      return;
    }

    if (!account && (userProfile?.walletAddress || userProfile?.address)) {
      const addr = userProfile.walletAddress || userProfile.address;
      setAccount({ address: addr, email: userProfile.email });
    }

    apiClient.setAuthToken(accessToken);

    if (userType === "customer") {
      router.replace("/customer/tabs/home");
    } else if (userType === "shop") {
      const isActive = userProfile?.isActive ?? userProfile?.active;
      const isApprovedShop = userProfile?.verified && isActive !== false;
      if (isApprovedShop) {
        router.replace("/shop/tabs/home");
      } else {
        const isSuspended =
          !!userProfile?.suspendedAt ||
          !!userProfile?.suspended_at ||
          (userProfile?.verified && isActive === false);
        router.replace(
          isSuspended ? "/register/suspended" : "/register/pending",
        );
      }
    } else {
      router.replace("/(auth)/connect");
    }
  };

  return { navigate, isAuthenticated, userProfile, hasHydrated };
};
