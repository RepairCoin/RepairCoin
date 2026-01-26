import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { TransactionsResponse, PurchasesResponse } from "@/interfaces/shop.interface";
import { TimeRange } from "../../types";
import { analyticsApi } from "@/feature/analytics/services/analytics.services";

export function useShopAnalyticsQuery(shopId: string, timeRange: TimeRange) {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case "month":
        start.setMonth(end.getMonth() - 12);
        break;
      case "year":
        start.setFullYear(end.getFullYear() - 5);
        break;
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [timeRange]);

  return useQuery({
    queryKey: queryKeys.shopAnalytics(shopId, timeRange),
    queryFn: async (): Promise<{
      transactions: TransactionsResponse;
      purchases: PurchasesResponse;
    }> => {
      const [transactions, purchases] = await Promise.all([
        analyticsApi
          .getShopTransactions(shopId, startDate, endDate)
          .catch(() => ({
            success: false,
            data: { transactions: [], total: 0, totalPages: 0, page: 1 },
          })),
        analyticsApi.getShopPurchases(shopId, startDate, endDate).catch(() => ({
          success: false,
          data: {
            items: [],
            pagination: {
              page: 1,
              limit: 100,
              totalItems: 0,
              totalPages: 0,
              hasMore: false,
            },
          },
        })),
      ]);

      return { transactions, purchases };
    },
    enabled: !!shopId,
    staleTime: 2 * 60 * 1000,
  });
}
