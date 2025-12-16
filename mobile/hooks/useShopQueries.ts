import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "@/config/queryClient";
import {
  UpdateShopData,
  ShopData,
  getShopTransactions,
  PurchaseHistoryResponse,
} from "@/services/ShopServices";
import { shopApi } from "@/services/shop.services";
import { ShopFormData, ShopResponse } from "@/interfaces/shop.interface";

export const useShops = () => {
  return useQuery({
    queryKey: queryKeys.shopList(),
    queryFn: async () => {
      const response: ShopResponse = await shopApi.listShops();
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateShopDetails = (address: string) => {
  return useMutation({
    mutationFn: async ({ shopId, shopData }: { shopId: string; shopData: ShopFormData }) => {
      const response: UpdateShopData = await shopApi.updateShopDetails(shopId, shopData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopByWalletAddress(address),
      });
    },
  });
};

export const useShopTransactions = (shopId: string) => {
  return useQuery({
    queryKey: queryKeys.shopTransactions(shopId),
    queryFn: async () => {
      const response: PurchaseHistoryResponse = await getShopTransactions(shopId);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

