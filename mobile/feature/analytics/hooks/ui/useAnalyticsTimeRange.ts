import { useState } from "react";
import { TimeRange } from "../../types";

export function useAnalyticsTimeRange() {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  return {
    timeRange,
    setTimeRange,
  };
}
