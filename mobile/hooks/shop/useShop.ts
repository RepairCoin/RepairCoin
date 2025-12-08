import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ShopCustomerGrowthResponse, ShopCustomersResponse, ShopFormData } from "@/interfaces/shop.interface";
import { shopApi } from "@/services/shop.services";
import { queryKeys } from "@/config/queryClient";
import { ShopByWalletAddressResponse } from "@/interfaces/shop.interface";

export function useShop() {
  const useRegisterShop = () => {
    return useMutation({
      mutationFn: async (formData: ShopFormData) => {
        if (!formData.walletAddress) {
          throw new Error("No wallet address provided");
        }

        return await shopApi.register(formData);
      },
      onSuccess: async (result) => {
        if (result.success) {
          router.push("/register/pending");
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

  const useGetShopCustomers = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopCustomers(shopId),
      queryFn: async () => {
        const response: ShopCustomersResponse = await shopApi.getShopCustomers(shopId);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useShopCustomerGrowth = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopCustomerGrowth(shopId),
      queryFn: async () => {
        const response: ShopCustomerGrowthResponse = await shopApi.getShopCustomerGrowth(shopId);
        return response?.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  return {
    useRegisterShop,
    useGetShopByWalletAddress,
    useGetShopCustomers,
    useShopCustomerGrowth,
  };
}
