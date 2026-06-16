import { useState, useCallback, useMemo } from "react";
import {
  useHistorySearch,
  useHistoryFilters,
  useShopTransactionsQuery,
} from "../hooks";
import { ShopTransactionData } from "../../services/token.interface";

export function useHistoryListUI() {
  const [refreshing, setRefreshing] = useState(false);

  const { searchQuery, setSearchQuery, hasSearchQuery, clearSearch } = useHistorySearch();

  const {
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    typeFilter,
    setTypeFilter,
    hasActiveFilters,
    clearFilters: clearFilterState,
  } = useHistoryFilters();

  const { data: transactionData, isLoading, error, refetch } = useShopTransactionsQuery();

  const rawTransactions = useMemo((): ShopTransactionData[] => {
    return transactionData?.transactions || [];
  }, [transactionData]);

  const transactions = useMemo((): ShopTransactionData[] => {
    let filtered = rawTransactions;

    if (typeFilter !== "all") {
      filtered = filtered.filter(
        (tx) => tx.type?.toLowerCase() === typeFilter
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx) => {
        const date = new Date(tx.createdAt).toLocaleDateString();
        if (date.toLowerCase().includes(query)) return true;
        if (tx.amount.toString().includes(query)) return true;
        if (tx.totalCost?.toString().includes(query)) return true;
        if (tx.paymentMethod?.toLowerCase().includes(query)) return true;
        if (tx.status?.toLowerCase().includes(query)) return true;
        if (tx.type?.toLowerCase().includes(query)) return true;
        if (tx.customerName?.toLowerCase().includes(query)) return true;
        if (tx.customerAddress?.toLowerCase().includes(query)) return true;
        return false;
      });
    }

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
  }, [rawTransactions, searchQuery, statusFilter, dateFilter, typeFilter]);

  const stats = useMemo(() => {
    const completedTx = rawTransactions.filter(
      (tx) =>
        tx.status?.toLowerCase() === "completed" ||
        tx.status?.toLowerCase() === "success"
    );
    const totalRcnPurchased = completedTx
      .filter((tx) => tx.type?.toLowerCase() === "purchase")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalSpent = completedTx
      .filter((tx) => tx.type?.toLowerCase() === "purchase")
      .reduce((sum, tx) => sum + (tx.totalCost || 0), 0);
    const totalRewarded = completedTx
      .filter((tx) => tx.type?.toLowerCase() === "reward")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalRedeemed = completedTx
      .filter((tx) => tx.type?.toLowerCase() === "redemption")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const pendingTx = rawTransactions.filter(
      (tx) => tx.status?.toLowerCase() === "pending"
    );

    return {
      totalRcnPurchased,
      totalSpent,
      totalRewarded,
      totalRedeemed,
      totalTransactions: rawTransactions.length,
      pendingCount: pendingTx.length,
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
    refreshing,
    handleRefresh,
    searchQuery,
    setSearchQuery,
    hasSearchQuery,
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
