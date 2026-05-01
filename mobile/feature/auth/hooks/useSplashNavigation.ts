import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useAppStore } from "@/shared/store/app.store";

export const useSplashNavigation = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userProfile = useAuthStore((state) => state.userProfile);
  const userType = useAuthStore((state) => state.userType);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const account = useAuthStore((state) => state.account);
  const hasSeenOnboarding = useAppStore((state) => state.hasSeenOnboarding);
  const setAccount = useAuthStore((state) => state.setAccount);

  const navigate = async () => {
    if (!hasHydrated) {
      return;
    }

    console.log("hasSeenOnboarding", hasSeenOnboarding);

    if (!hasSeenOnboarding) {
      router.replace("/(auth)/onboarding");
      return;
    }

    if (!isAuthenticated || !userProfile?.address || !accessToken) {
      router.replace("/(auth)/connect");
      return;
    }

    if (!account) {
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
