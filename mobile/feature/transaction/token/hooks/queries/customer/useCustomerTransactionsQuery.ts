import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { customerApi } from "@/feature/role/customer/profile/services/customer.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { TransactionResponse } from "@/shared/interfaces/customer.interface";

const PAGE_SIZE = 20;

export function useCustomerTransactionsQuery(limit: number = PAGE_SIZE) {
  const { account } = useAuthStore();
  const address = account?.address || "";

  return useInfiniteQuery({
    queryKey: [...queryKeys.customerTransactions(address), "infinite", limit],
    queryFn: async ({ pageParam = 1 }) => {
      const response: TransactionResponse = await customerApi.getTransactionByWalletAddress(
        address,
        limit,
        pageParam
      );
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.pagination?.hasMore) {
        return (lastPage.pagination.page || 1) + 1;
      }
      return undefined;
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000,
  });
}
