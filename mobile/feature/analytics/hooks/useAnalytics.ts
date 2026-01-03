import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { analyticsApi } from "../services";
import {
  ChartDataPoint,
  ProfitData,
  ProfitMetrics,
  TimeRange,
  Transaction,
  Purchase,
} from "../types";

export function useAnalytics(shopId: string) {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  // Calculate date range based on timeRange
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case "month":
        start.setMonth(end.getMonth() - 12); // Last 12 months
        break;
      case "year":
        start.setFullYear(end.getFullYear() - 5); // Last 5 years
        break;
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [timeRange]);

  // Fetch profit data
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.shopAnalytics(shopId, timeRange),
    queryFn: async () => {
      const result = await analyticsApi.getProfitData(shopId, startDate, endDate);
      return result;
    },
    enabled: !!shopId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Format date by range
  const formatDateByRange = useCallback(
    (date: Date, range: TimeRange): string => {
      switch (range) {
        case "month":
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        case "year":
          return String(date.getFullYear());
      }
    },
    []
  );

  // Format label for chart display
  const formatLabel = useCallback((dateStr: string, range: TimeRange): string => {
    switch (range) {
      case "month":
        const monthDate = new Date(dateStr + "-01");
        return monthDate.toLocaleDateString("en-US", { month: "short" });
      case "year":
        return dateStr;
      default:
        return dateStr;
    }
  }, []);

  // Process raw data to profit data
  const profitData = useMemo((): ProfitData[] => {
    if (!rawData) return [];

    const transactions = rawData.transactions?.data?.transactions || [];
    const purchases = rawData.purchases?.data?.items || [];

    const dataMap = new Map<
      string,
      {
        revenue: number;
        costs: number;
        rcnPurchased: number;
        rcnIssued: number;
      }
    >();

    // Process purchases (costs)
    purchases.forEach((purchase: Purchase) => {
      if (purchase.status === "completed" || !purchase.status) {
        const date = formatDateByRange(
          new Date(purchase.created_at),
          timeRange
        );
        const existing = dataMap.get(date) || {
          revenue: 0,
          costs: 0,
          rcnPurchased: 0,
          rcnIssued: 0,
        };
        const purchaseCost = parseFloat(String(purchase.total_cost || 0));
        const purchaseAmount = parseFloat(String(purchase.amount || 0));

        dataMap.set(date, {
          ...existing,
          costs: existing.costs + purchaseCost,
          rcnPurchased: existing.rcnPurchased + purchaseAmount,
        });
      }
    });

    // Process transactions (revenue)
    transactions.forEach((transaction: Transaction) => {
      if (transaction.type === "reward" || transaction.type === "mint") {
        const date = formatDateByRange(
          new Date(transaction.createdAt),
          timeRange
        );
        const existing = dataMap.get(date) || {
          revenue: 0,
          costs: 0,
          rcnPurchased: 0,
          rcnIssued: 0,
        };

        // Calculate repair revenue
        let repairRevenue = 0;
        if (transaction.repairAmount) {
          repairRevenue = transaction.repairAmount;
        } else {
          // Fallback: 1 RCN = $10 repair work
          const rcnAmount = parseFloat(String(transaction.amount || 0));
          repairRevenue = rcnAmount * 10;
        }

        dataMap.set(date, {
          ...existing,
          revenue: existing.revenue + repairRevenue,
          rcnIssued: existing.rcnIssued + parseFloat(String(transaction.amount || 0)),
        });
      }
    });

    // Convert to array and sort by date
    return Array.from(dataMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs,
        rcnPurchased: data.rcnPurchased,
        rcnIssued: data.rcnIssued,
        profitMargin:
          data.revenue > 0
            ? ((data.revenue - data.costs) / data.revenue) * 100
            : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [rawData, timeRange, formatDateByRange]);

  // Calculate metrics
  const metrics = useMemo((): ProfitMetrics | null => {
    if (profitData.length === 0) return null;

    const totalProfit = profitData.reduce((sum, item) => sum + item.profit, 0);
    const totalRevenue = profitData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCosts = profitData.reduce((sum, item) => sum + item.costs, 0);
    const averageProfitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Calculate trend
    const midPoint = Math.floor(profitData.length / 2);
    const firstHalf = profitData.slice(0, midPoint);
    const secondHalf = profitData.slice(midPoint);

    const firstHalfAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, item) => sum + item.profit, 0) / firstHalf.length
        : 0;
    const secondHalfAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, item) => sum + item.profit, 0) / secondHalf.length
        : 0;

    let profitTrend: "up" | "down" | "flat" = "flat";
    if (secondHalfAvg > firstHalfAvg * 1.05) profitTrend = "up";
    else if (secondHalfAvg < firstHalfAvg * 0.95) profitTrend = "down";

    return {
      totalProfit,
      totalRevenue,
      totalCosts,
      averageProfitMargin,
      profitTrend,
    };
  }, [profitData]);

  // Transform to chart data format
  const chartData = useMemo(() => {
    // Profit data (positive profits)
    const profitChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: Math.max(0, item.profit),
      label: formatLabel(item.date, timeRange),
    }));

    // Loss data (absolute value of negative profits)
    const lossChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: Math.abs(Math.min(0, item.profit)),
      label: formatLabel(item.date, timeRange),
    }));

    // Revenue data
    const revenueChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: item.revenue,
      label: formatLabel(item.date, timeRange),
    }));

    // Cost data
    const costChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: item.costs,
      label: formatLabel(item.date, timeRange),
    }));

    return {
      profit: profitChartData,
      loss: lossChartData,
      revenue: revenueChartData,
      cost: costChartData,
    };
  }, [profitData, timeRange, formatLabel]);

  return {
    // Data
    profitData,
    chartData,
    metrics,
    // State
    timeRange,
    setTimeRange,
    // Query state
    isLoading,
    error,
    refetch,
  };
}
