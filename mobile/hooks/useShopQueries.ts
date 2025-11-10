import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import {
  ShopResponse,
  listShops,
  getShopByWalletAddress,
  ShopByWalletAddressResponse,
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
      const response: ShopByWalletAddressResponse = await getShopByWalletAddress(walletAddress);
      console.log("SHOPP RESPONSEE: ", response)
      return response;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
