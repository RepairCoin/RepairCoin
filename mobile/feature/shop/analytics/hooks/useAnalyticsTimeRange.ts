import { useState } from "react";
import { TimeRange } from "@/feature/shop/services/shop.interface";

export function useAnalyticsTimeRange() {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  return {
    timeRange,
    setTimeRange,
  };
}
