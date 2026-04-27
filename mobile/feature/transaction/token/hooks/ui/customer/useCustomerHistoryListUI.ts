import { useState, useCallback, useMemo } from "react";
import { TransactionData } from "@/shared/interfaces/customer.interface";
import { useCustomerTransactionsQuery } from "../../queries/customer/useCustomerTransactionsQuery";
import { useHistorySearch } from "../shared/useHistorySearch";
import { useCustomerHistoryFilters } from "./useCustomerHistoryFilters";

export function useCustomerHistoryListUI() {
  const [refreshing, setRefreshing] = useState(false);

  // Search
  const { searchQuery, setSearchQuery, hasSearchQuery, clearSearch } = useHistorySearch();

  // Filters
  const {
    transactionFilter,
    setTransactionFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters: clearFilterState,
  } = useCustomerHistoryFilters();

  // Query
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCustomerTransactionsQuery();

  // Raw transactions (all types including rejected/cancelled) — flattened from paged data
  const rawTransactions = useMemo((): TransactionData[] => {
    return data?.pages.flatMap((page: any) => page?.transactions || []) || [];
  }, [data]);

  // Filtered transactions
  const transactions = useMemo((): TransactionData[] => {
    let filtered = rawTransactions;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx) =>
        tx.shopName?.toLowerCase().includes(query) ||
        tx.type?.toLowerCase().includes(query) ||
        tx.description?.toLowerCase().includes(query)
      );
    }

    // Filter by transaction type
    if (transactionFilter !== "all") {
      filtered = filtered.filter((tx) => {
        const type = tx.type?.toLowerCase();
        switch (transactionFilter) {
          case "earned":
            return ["earned", "bonus", "referral", "tier_bonus", "mint"].includes(type);
          case "redeemed":
            return ["redeemed", "redemption", "service_redemption", "service_redemption_refund"].includes(type);
          case "gifts":
            return ["transfer_in", "transfer_out", "gift", "gift_received", "gift_sent"].includes(type);
          default:
            return true;
        }
      });
    }

    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        switch (dateFilter) {
          case "today":
            return txDate >= startOfDay;
          case "week":
            return txDate >= startOfWeek;
          case "month":
            return txDate >= startOfMonth;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [rawTransactions, searchQuery, transactionFilter, dateFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const earned = rawTransactions
      .filter((tx) =>
        ["earned", "bonus", "referral", "tier_bonus", "transfer_in", "mint"].includes(tx.type?.toLowerCase())
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const redeemed = rawTransactions
      .filter((tx) =>
        ["redeemed", "redemption", "service_redemption", "transfer_out"].includes(tx.type?.toLowerCase())
      )
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return {
      earned,
      redeemed,
      total: rawTransactions.length,
    };
  }, [rawTransactions]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Clear all filters and search
  const clearFilters = useCallback(() => {
    clearSearch();
    clearFilterState();
  }, [clearSearch, clearFilterState]);

  return {
    // Data
    transactions,
    stats,
    transactionCount: transactions.length,
    // Query state
    isLoading,
    error,
    refetch,
    // Pagination
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Refresh
    refreshing,
    handleRefresh,
    // Search
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    // Filters
    transactionFilter,
    setTransactionFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
  };
}
