import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CreateShopRequest } from "@/interfaces/shop.interface";
import { shopApi } from "@/services/shop.services";
import { useAuthStore } from "@/store/auth.store";
import { useAuth } from "../auth/useAuth";
import apiClient from "@/utilities/axios";
import { queryKeys } from "@/config/queryClient";
import { ShopByWalletAddressResponse } from "@/interfaces/shop.interface";

export function useShop() {
  const useRegisterShop = () => {
    const setUserProfile = useAuthStore((state) => state.setUserProfile);
    const setAccessToken = useAuthStore((state) => state.setAccessToken);
    const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
    const setUserType = useAuthStore((state) => state.setUserType);
    const { useGetToken } = useAuth();

    const getTokenMutation = useGetToken();

    return useMutation({
      mutationFn: async (formData: CreateShopRequest) => {
        if (!formData.walletAddress) {
          throw new Error("No wallet address provided");
        }

        return await shopApi.register(formData);
      },
      onSuccess: async (result) => {
        if (result.success) {
          const getTokenResult = await getTokenMutation.mutateAsync(
            result.user?.walletAddress
          );
          if (getTokenResult.success) {
            setUserProfile(result.user);
            setAccessToken(getTokenResult.token);
            setRefreshToken(getTokenResult.refreshToken);
            setUserType(result.type);
            apiClient.setAuthToken(getTokenResult.token);

            router.push("/shop/tabs/home");
          }
        }
      },
      onError: (error: any) => {
        console.error("[useRegisterShop] Error:", error);
        throw error;
      },
    });
  };

  const useGetShopByWalletAddress = (address: string) => {
    return useQuery({
      queryKey: queryKeys.shopByWalletAddress(address),
      queryFn: async () => {
        const response: ShopByWalletAddressResponse = await shopApi.getShopByWalletAddress(address);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  return {
    useRegisterShop,
    useGetShopByWalletAddress,
  };
}
