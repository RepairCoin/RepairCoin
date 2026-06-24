import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useBootStore } from "@/shared/store/boot.store";

// Static, no-data destinations lift the boot splash immediately (there's no
// screen data to wait for). Data-backed home screens lift it themselves once
// loaded, via useEndBootWhenReady.
const endBoot = () => useBootStore.getState().endBoot();

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

  const navigate = async () => {
    if (!hasHydrated) {
      return;
    }

    if (!isAuthenticated || !userProfile?.address || !accessToken || !account) {
      router.replace("/connect");
      endBoot();
      return;
    }

    if (!account && (userProfile?.walletAddress || userProfile?.address)) {
      const addr = userProfile.walletAddress || userProfile.address;
      setAccount({ address: addr, email: userProfile.email });
    }

    apiClient.setAuthToken(accessToken);

    if (userType === "customer") {
      const isActive = userProfile?.isActive ?? userProfile?.active;
      const isSuspended =
        !!userProfile?.suspendedAt ||
        !!userProfile?.suspended_at ||
        isActive === false;
      if (isSuspended) {
        router.replace("/register/customer-suspended");
        endBoot();
      } else {
        router.replace("/customer/tabs/home");
      }
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
        endBoot();
      }
    } else {
      router.replace("/connect");
      endBoot();
    }
  };

  return { navigate, isAuthenticated, userProfile, hasHydrated };
};
