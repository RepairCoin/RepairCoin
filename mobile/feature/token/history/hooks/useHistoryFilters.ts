import { useState, useCallback } from "react";
import {
  DateFilter,
  StatusFilter,
  ShopTransactionTypeFilter,
} from "../../services/token.interface";

export function useHistoryFilters() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter] =
    useState<ShopTransactionTypeFilter>("all");

  const hasActiveFilters =
    statusFilter !== "all" || dateFilter !== "all" || typeFilter !== "all";

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setDateFilter("all");
    setTypeFilter("all");
  }, []);

  return {
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    typeFilter,
    setTypeFilter,
    hasActiveFilters,
    clearFilters,
  };
}
