import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { balanceApi } from "@/services/balance.services";

export const useBalance = () => {
  return useQuery({
    queryKey: queryKeys.customerBalace(),
    queryFn: async () => {
      const response: any = await balanceApi.getCustomerBalance();
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};