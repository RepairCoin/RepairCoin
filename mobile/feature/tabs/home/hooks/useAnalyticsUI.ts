import { useState } from "react";
import { TimeRange } from "../types";

export const TIME_RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: "month", label: "Monthly" },
  { id: "year", label: "Yearly" },
];

export function useAnalyticsUI() {
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  return {
    timeRange,
    setTimeRange,
  };
}
