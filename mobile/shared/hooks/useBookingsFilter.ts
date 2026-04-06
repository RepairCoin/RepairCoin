import { useState } from "react";

export function useBookingsFilter<T extends string = string>(initialStatus: T = "all" as T) {
  const [statusFilter, setStatusFilter] = useState<T>(initialStatus);

  return {
    statusFilter,
    setStatusFilter,
  };
}
