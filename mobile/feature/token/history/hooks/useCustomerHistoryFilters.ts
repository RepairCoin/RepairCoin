import { useState, useCallback } from "react";
import { DateFilter, TransactionFilter } from "../../services/token.interface";

export function useCustomerHistoryFilters() {
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const hasActiveFilters = transactionFilter !== "all" || dateFilter !== "all";

  const clearFilters = useCallback(() => {
    setTransactionFilter("all");
    setDateFilter("all");
  }, []);

  return {
    transactionFilter,
    setTransactionFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
  };
}
