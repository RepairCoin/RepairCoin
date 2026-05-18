import { useState, useCallback, useMemo } from "react";
import { TransactionData } from "@/feature/customer/profile/services/customer.interface";
import { useCustomerTransactionsQuery } from "./useTokensQuery";
import { useHistorySearch } from "./useHistorySearch";
import { useCustomerHistoryFilters } from "./useCustomerHistoryFilters";

export function useCustomerHistoryListUI() {
  const [refreshing, setRefreshing] = useState(false);

  const { searchQuery, setSearchQuery, hasSearchQuery, clearSearch } = useHistorySearch();

  const {
    transactionFilter,
    setTransactionFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters: clearFilterState,
  } = useCustomerHistoryFilters();

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCustomerTransactionsQuery();

  const rawTransactions = useMemo((): TransactionData[] => {
    return data?.pages.flatMap((page: any) => page?.transactions || []) || [];
  }, [data]);

  const transactions = useMemo((): TransactionData[] => {
    let filtered = rawTransactions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx) =>
        tx.shopName?.toLowerCase().includes(query) ||
        tx.type?.toLowerCase().includes(query) ||
        tx.description?.toLowerCase().includes(query)
      );
    }

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

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const clearFilters = useCallback(() => {
    clearSearch();
    clearFilterState();
  }, [clearSearch, clearFilterState]);

  return {
    transactions,
    stats,
    transactionCount: transactions.length,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refreshing,
    handleRefresh,
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    transactionFilter,
    setTransactionFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
  };
}
