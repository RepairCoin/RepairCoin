import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { balanceApi } from "@/services/balance.services";

export const useBalance = (walletAddress: string) => {
  return useQuery({
    queryKey: ["balance"],
    queryFn: async () => {
      const response: any = await balanceApi.getCustomerBalance (walletAddress);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};