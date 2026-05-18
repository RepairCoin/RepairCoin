import { useState, useCallback } from "react";
import { DateFilter, StatusFilter } from "../../services/token.interface";

export function useHistoryFilters() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const hasActiveFilters = statusFilter !== "all" || dateFilter !== "all";

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setDateFilter("all");
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
  };
}
