import { useState, useCallback, useMemo } from "react";
import { PurchaseHistoryData } from "@/interfaces/purchase.interface";
import { useShopTransactionsQuery } from "../queries/useHistoryQueries";
import { useHistorySearch } from "./useHistorySearch";
import { useHistoryFilters } from "./useHistoryFilters";

export function useHistoryListUI() {
  const [refreshing, setRefreshing] = useState(false);

  // Search
  const { searchQuery, setSearchQuery, hasSearchQuery, clearSearch } = useHistorySearch();

  // Filters
  const {
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters: clearFilterState,
  } = useHistoryFilters();

  // Query
  const { data: transactionData, isLoading, error, refetch } = useShopTransactionsQuery();

  // Raw transactions
  const rawTransactions = useMemo((): PurchaseHistoryData[] => {
    return transactionData?.purchases || [];
  }, [transactionData]);

  // Filtered transactions
  const transactions = useMemo((): PurchaseHistoryData[] => {
    let filtered = rawTransactions;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        if (date.toLowerCase().includes(query)) return true;
        if (tx.amount.toString().includes(query)) return true;
        if (tx.totalCost?.toString().includes(query)) return true;
        if (tx.paymentMethod?.toLowerCase().includes(query)) return true;
        if (tx.status?.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((tx) => {
        const status = tx.status?.toLowerCase();
        switch (statusFilter) {
          case "pending":
            return status === "pending";
          case "completed":
            return status === "completed" || status === "success";
          case "failed":
            return status === "failed" || status === "cancelled";
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
  }, [rawTransactions, searchQuery, statusFilter, dateFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completedTx = rawTransactions.filter(
      (tx) =>
        tx.status?.toLowerCase() === "completed" ||
        tx.status?.toLowerCase() === "success"
    );
    const totalRcnPurchased = completedTx.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSpent = completedTx.reduce((sum, tx) => sum + (tx.totalCost || 0), 0);
    const pendingTx = rawTransactions.filter(
      (tx) => tx.status?.toLowerCase() === "pending"
    );

    return {
      totalRcnPurchased,
      totalSpent,
      totalTransactions: rawTransactions.length,
      pendingCount: pendingTx.length,
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
    // Refresh
    refreshing,
    handleRefresh,
    // Search
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
    // Filters
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
  };
}
