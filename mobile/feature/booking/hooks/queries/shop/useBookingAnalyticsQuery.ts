import { useQuery } from "@tanstack/react-query";
import { bookingAnalyticsApi } from "../../services/bookingAnalytics.services";
import { TrendDays } from "../../types";

export function useBookingAnalyticsQuery(trendDays: TrendDays) {
  return useQuery({
    queryKey: ["repaircoin", "bookingAnalytics", trendDays],
    queryFn: () => bookingAnalyticsApi.getBookingAnalytics(trendDays),
    staleTime: 5 * 60 * 1000,
  });
}
