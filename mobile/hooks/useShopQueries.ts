import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "@/config/queryClient";
import {
  ShopResponse,
  listShops,
  updateShopDetails,
  UpdateShopData,
  ShopData,
  getShopTransactions,
  PurchaseHistoryResponse,
} from "@/services/ShopServices";

export const useShops = () => {
  return useQuery({
    queryKey: queryKeys.shops(),
    queryFn: async () => {
      const response: ShopResponse = await listShops();
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateShopDetails = (address: string) => {
  return useMutation({
    mutationFn: async ({ shopId, shopData }: { shopId: string; shopData: ShopData }) => {
      const response: UpdateShopData = await updateShopDetails(shopId, shopData);
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

