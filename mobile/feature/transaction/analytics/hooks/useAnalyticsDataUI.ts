import { useCallback, useMemo } from "react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { Transaction, Purchase } from "@/shared/interfaces/shop.interface";
import { useShopAnalyticsQuery } from "./useShopAnalyticsQuery";
import { useAnalyticsTimeRange } from "./useAnalyticsTimeRange";
import { 
  TimeRange, 
  ProfitData, 
  ChartDataPoint,
  ProfitMetrics,
} from "../types";

export function useAnalyticsDataUI() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  const { timeRange, setTimeRange } = useAnalyticsTimeRange();

  const { data: rawData, isLoading, error, refetch } = useShopAnalyticsQuery(shopId, timeRange);

  const formatDateByRange = useCallback(
    (date: Date, range: TimeRange): string => {
      switch (range) {
        case "day":
          return date.toISOString().split("T")[0];
        case "month":
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        case "year":
          return String(date.getFullYear());
        default:
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    },
    []
  );

  const formatLabel = useCallback(
    (dateStr: string, range: TimeRange): string => {
      switch (range) {
        case "day":
          const dayDate = new Date(dateStr);
          return dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        case "month":
          const monthDate = new Date(dateStr + "-01");
          return monthDate.toLocaleDateString("en-US", { month: "short" });
        case "year":
          return dateStr;
        default:
          return dateStr;
      }
    },
    []
  );

  const profitData = useMemo((): ProfitData[] => {
    if (!rawData) return [];

    const transactions = rawData.transactions?.data?.transactions || [];
    const purchases = rawData.purchases?.data?.items || [];

    const dataMap = new Map<
      string,
      { revenue: number; costs: number; rcnPurchased: number; rcnIssued: number }
    >();

    purchases.forEach((purchase: Purchase) => {
      if (purchase.status === "completed" || !purchase.status) {
        const date = formatDateByRange(new Date(purchase.created_at), timeRange);
        const existing = dataMap.get(date) || { revenue: 0, costs: 0, rcnPurchased: 0, rcnIssued: 0 };
        const purchaseCost = parseFloat(String(purchase.total_cost || 0));
        const purchaseAmount = parseFloat(String(purchase.amount || 0));

        dataMap.set(date, {
          ...existing,
          costs: existing.costs + purchaseCost,
          rcnPurchased: existing.rcnPurchased + purchaseAmount,
        });
      }
    });

    transactions.forEach((transaction: Transaction) => {
      if (transaction.type === "reward" || transaction.type === "mint") {
        const date = formatDateByRange(new Date(transaction.createdAt), timeRange);
        const existing = dataMap.get(date) || { revenue: 0, costs: 0, rcnPurchased: 0, rcnIssued: 0 };

        let repairRevenue = 0;
        if (transaction.repairAmount) {
          repairRevenue = transaction.repairAmount;
        } else {
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

    return Array.from(dataMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs,
        rcnPurchased: data.rcnPurchased,
        rcnIssued: data.rcnIssued,
        profitMargin: data.revenue > 0 ? ((data.revenue - data.costs) / data.revenue) * 100 : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [rawData, timeRange, formatDateByRange]);

  const metrics = useMemo((): ProfitMetrics | null => {
    if (profitData.length === 0) return null;

    const totalProfit = profitData.reduce((sum, item) => sum + item.profit, 0);
    const totalRevenue = profitData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCosts = profitData.reduce((sum, item) => sum + item.costs, 0);
    const averageProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const midPoint = Math.floor(profitData.length / 2);
    const firstHalf = profitData.slice(0, midPoint);
    const secondHalf = profitData.slice(midPoint);

    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, item) => sum + item.profit, 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, item) => sum + item.profit, 0) / secondHalf.length
      : 0;

    let profitTrend: "up" | "down" | "flat" = "flat";
    if (secondHalfAvg > firstHalfAvg * 1.05) profitTrend = "up";
    else if (secondHalfAvg < firstHalfAvg * 0.95) profitTrend = "down";

    return { totalProfit, totalRevenue, totalCosts, averageProfitMargin, profitTrend };
  }, [profitData]);

  const chartData = useMemo(() => {
    const profitLossChartData = profitData.map((item) => ({
      value: item.profit,
      label: formatLabel(item.date, timeRange),
      dataPointColor: item.profit >= 0 ? "#10B981" : "#EF4444",
    }));

    const revenueChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: item.revenue,
      label: formatLabel(item.date, timeRange),
    }));

    const costChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: item.costs,
      label: formatLabel(item.date, timeRange),
    }));

    const profitMarginChartData: ChartDataPoint[] = profitData.map((item) => ({
      value: item.profitMargin,
      label: formatLabel(item.date, timeRange),
    }));

    return {
      profitLoss: profitLossChartData,
      revenue: revenueChartData,
      cost: costChartData,
      profitMargin: profitMarginChartData,
    };
  }, [profitData, timeRange, formatLabel]);

  return {
    profitData,
    chartData,
    metrics,
    isLoading,
    error,
    refetch,
    timeRange,
    setTimeRange,
  };
}
