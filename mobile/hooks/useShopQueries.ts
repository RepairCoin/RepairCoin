import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, queryKeys } from "@/config/queryClient";
import {
  ShopResponse,
  listShops,
  getShopByWalletAddress,
  ShopByWalletAddressResponse,
  updateShopDetails,
  UpdateShopData,
  ShopData,
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

export const useShopByWalletAddress = (walletAddress: string) => {
  return useQuery({
    queryKey: queryKeys.shopByWalletAddress(walletAddress),
    queryFn: async () => {
      const response: ShopByWalletAddressResponse =
        await getShopByWalletAddress(walletAddress);
      return response;
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
