import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { balanceApi } from "@/feature/redeem-token/services/balance.services";

export const useBalance = (walletAddress: string) => {
  return useQuery({
    queryKey: queryKeys.tokenBalance(walletAddress),
    queryFn: async () => {
      const response: any = await balanceApi.getCustomerBalance(walletAddress);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};