import { useAuthStore } from "@/feature/auth/store/auth.store";
import { TransactionResponse } from "@/feature/customer/profile/services/customer.interface";
import { customerApi } from "@/feature/customer/profile/services/customer.services";
import { shopApi } from "@/feature/shop/services/shop.services";
import { queryKeys } from "@/shared/hooks";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 20;

export function useCustomerTransactionsQuery(limit: number = PAGE_SIZE) {
  const { account } = useAuthStore();
  const address = account?.address || "";

  return useInfiniteQuery({
    queryKey: [...queryKeys.customerTransactions(address), "infinite", limit],
    queryFn: async ({ pageParam = 1 }) => {
      const response: TransactionResponse =
        await customerApi.getTransactionByWalletAddress(address, limit, pageParam);
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

export function useShopTransactionsQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopTransactions(shopId),
    queryFn: async () => {
      const response = await shopApi.getPurchaseHistory(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}