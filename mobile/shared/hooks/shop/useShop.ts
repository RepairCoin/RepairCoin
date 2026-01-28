import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ShopCustomerGrowthResponse,
  ShopCustomersResponse,
  ShopFormData,
  ShopResponse,
} from "@/shared/interfaces/shop.interface";
import { shopApi } from "@/shared/services/shop.services";
import { queryClient, queryKeys } from "@/shared/config/queryClient";
import { ShopByWalletAddressResponse } from "@/shared/interfaces/shop.interface";
import { promoCodeApi } from "@/feature/promo-code/services/promocode.services";

export function useShop() {
  const useGetShops = () => {
    return useQuery({
      queryKey: queryKeys.shopList(),
      queryFn: async () => {
        const response: ShopResponse = await shopApi.listShops();
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useGetShopByWalletAddress = (address: string) => {
    return useQuery({
      queryKey: queryKeys.shopByWalletAddress(address),
      queryFn: async () => {
        const response: ShopByWalletAddressResponse =
          await shopApi.getShopByWalletAddress(address);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useGetShopById = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shop(shopId),
      queryFn: async () => {
        const response: ShopByWalletAddressResponse =
          await shopApi.getShopById(shopId);
        return response.data;
      },
      enabled: !!shopId,
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useGetShopCustomers = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopCustomers(shopId),
      queryFn: async () => {
        const response: ShopCustomersResponse =
          await shopApi.getShopCustomers(shopId);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useShopCustomerGrowth = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopCustomerGrowth(shopId),
      queryFn: async () => {
        const response: ShopCustomerGrowthResponse =
          await shopApi.getShopCustomerGrowth(shopId);
        return response?.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useShopPromoCodes = (shopId: string) => {
    return useQuery({
      queryKey: queryKeys.shopPromoCodes(shopId),
      queryFn: async () => {
        const response: any = await promoCodeApi.getPromoCodes(shopId);
        return response.data;
      },
      enabled: !!shopId,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    });
  };

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

  const useUpdateShop = (address: string) => {
    return useMutation({
      mutationFn: async ({
        shopId,
        shopData,
      }: {
        shopId: string;
        shopData: ShopFormData;
      }) => {
        const response: { message: string; success: boolean } =
          await shopApi.updateShopDetails(shopId, shopData);
        return response;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.shopByWalletAddress(address),
        });
      },
    });
  };

  return {
    useRegisterShop,
    useGetShops,
    useGetShopByWalletAddress,
    useGetShopById,
    useGetShopCustomers,
    useShopCustomerGrowth,
    useShopPromoCodes,
    useUpdateShop,
  };
}
