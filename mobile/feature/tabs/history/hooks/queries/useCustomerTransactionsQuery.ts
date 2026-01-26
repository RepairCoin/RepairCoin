import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { customerApi } from "@/shared/services/customer.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { TransactionResponse } from "@/interfaces/customer.interface";

export function useCustomerTransactionsQuery(limit: number = 50) {
  const { account } = useAuthStore();
  const address = account?.address || "";

  return useQuery({
    queryKey: queryKeys.customerTransactions(address),
    queryFn: async () => {
      const response: TransactionResponse = await customerApi.getTransactionByWalletAddress(
        address,
        limit
      );
      return response.data;
    },
    enabled: !!address,
    staleTime: 10 * 60 * 1000,
  });
}
