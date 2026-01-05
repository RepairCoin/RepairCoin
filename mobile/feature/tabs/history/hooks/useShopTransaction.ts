import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/hooks";
import { purchaseApi } from "@/services/purchase.services";
import { useAuthStore } from "@/store/auth.store";
import { PurchaseHistoryData } from "@/interfaces/purchase.interface";
import { StatusFilter, DateFilter } from "../types";

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];

export const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

export function useShopTransaction() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: transactionData,
    isLoading,
    error,
    refetch: refetchTransaction,
  } = useQuery({
    queryKey: queryKeys.shopTransactions(shopId),
    queryFn: async () => {
      const response = await purchaseApi.getShopTransactions(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Raw transactions
  const transactions = useMemo((): PurchaseHistoryData[] => {
    return transactionData?.purchases || [];
  }, [transactionData]);

  // Filtered transactions
  const filteredTransactions = useMemo((): PurchaseHistoryData[] => {
    let filtered = transactions;

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
  }, [transactions, searchQuery, statusFilter, dateFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completedTx = transactions.filter(
      (tx) =>
        tx.status?.toLowerCase() === "completed" ||
        tx.status?.toLowerCase() === "success"
    );
    const totalRcnPurchased = completedTx.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSpent = completedTx.reduce((sum, tx) => sum + (tx.totalCost || 0), 0);
    const pendingTx = transactions.filter(
      (tx) => tx.status?.toLowerCase() === "pending"
    );

    return {
      totalRcnPurchased,
      totalSpent,
      totalTransactions: transactions.length,
      pendingCount: pendingTx.length,
    };
  }, [transactions]);

  // Check if any filter is active
  const hasActiveFilters = statusFilter !== "all" || dateFilter !== "all";

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetchTransaction();
    } finally {
      setRefreshing(false);
    }
  }, [refetchTransaction]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
  }, []);

  return {
    // Data
    transactions: filteredTransactions,
    stats,
    transactionCount: filteredTransactions.length,
    // Filters
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    hasActiveFilters,
    clearFilters,
    // Query state
    isLoading,
    error,
    refreshing,
    handleRefresh,
  };
}
