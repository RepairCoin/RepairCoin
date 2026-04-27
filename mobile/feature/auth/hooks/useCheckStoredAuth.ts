import { useCallback, useState } from "react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import apiClient from "@/shared/utilities/axios";

export const useCheckStoredAuth = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userType = useAuthStore((state) => state.userType);
  const userProfile = useAuthStore((state) => state.userProfile);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);
  const [isChecking, setIsChecking] = useState(false);

  const checkStoredAuth = useCallback(async () => {
    if (!accessToken || !userType) return;

    try {
      setIsChecking(true);
      setIsLoading(true);

      if (userType === "shop" && userProfile?.walletAddress) {
        const response = await apiClient.get(
          `/shops/wallet/${userProfile.walletAddress}`,
        );
        if (response?.data?.shop) {
          setUserProfile(response.data.shop);
        }
      } else if (userType === "customer" && userProfile?.walletAddress) {
        const response = await apiClient.get(
          `/customers/wallet/${userProfile.walletAddress}`,
        );
        if (response?.data?.customer) {
          setUserProfile(response.data.customer);
        }
      }
    } catch (error) {
      console.error("[Auth] Error checking stored auth:", error);
    } finally {
      setIsLoading(false);
      setIsChecking(false);
    }
  }, [accessToken, userType, userProfile?.walletAddress, setUserProfile, setIsLoading]);

  return { checkStoredAuth, isChecking };
};
