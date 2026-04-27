import { useState, useCallback } from "react";
import { TrendDays } from "../../../types";
import { useBookingAnalyticsQuery } from "../queries/useBookingAnalyticsQuery";

export function useBookingAnalyticsUI() {
  const [trendDays, setTrendDays] = useState<TrendDays>(30);

  const { data, isLoading, error, refetch } = useBookingAnalyticsQuery(trendDays);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    analytics: data,
    isLoading,
    error,
    trendDays,
    setTrendDays,
    refetch: onRefresh,
  };
}
