import { useState, useCallback, useMemo } from "react";
import { CustomerData } from "@/shared/interfaces/customer.interface";
import { useShopCustomersQuery, useSearchAllCustomersQuery } from "../queries/useCustomerQueries";
import { useCustomerSearch } from "./useCustomerSearch";

export type ViewMode = "my-customers" | "search-all";
export type TierFilter = "all" | "bronze" | "silver" | "gold";
export type SortBy = "recent" | "earnings" | "active";

export function useCustomerListUI() {
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("my-customers");
  const [searchAllQuery, setSearchAllQuery] = useState("");
  const [hasSearchedAll, setHasSearchedAll] = useState(false);

  // Filters for My Customers tab
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  // Search for My Customers tab
  const { searchText, setSearchText, hasSearchQuery, clearSearch } = useCustomerSearch();

  // Query for My Customers
  const { data: shopCustomerData, isLoading: isLoadingMyCustomers, error: myCustomersError, refetch: refetchMyCustomers } = useShopCustomersQuery();

  // Query for Search All Customers
  const {
    data: searchAllData,
    isLoading: isSearchingAll,
    error: searchAllError,
    refetch: refetchSearchAll
  } = useSearchAllCustomersQuery(searchAllQuery, hasSearchedAll);

  // Filter and sort My Customers
  const myCustomers = useMemo((): CustomerData[] => {
    let customers = shopCustomerData?.customers || [];

    // Filter by search text
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      customers = customers.filter((customer: CustomerData) =>
        customer?.name?.toLowerCase().includes(query) ||
        customer?.address?.toLowerCase().includes(query)
      );
    }

    // Filter by tier
    if (tierFilter !== "all") {
      customers = customers.filter((customer: CustomerData) =>
        customer?.tier?.toLowerCase() === tierFilter
      );
    }

    // Sort customers
    customers = [...customers].sort((a, b) => {
      switch (sortBy) {
        case "earnings":
          return (b.lifetimeEarnings || 0) - (a.lifetimeEarnings || 0);
        case "active":
          return (b.total_transactions || 0) - (a.total_transactions || 0);
        case "recent":
        default:
          const dateA = a.last_transaction_date ? new Date(a.last_transaction_date).getTime() : 0;
          const dateB = b.last_transaction_date ? new Date(b.last_transaction_date).getTime() : 0;
          return dateB - dateA;
      }
    });

    return customers;
  }, [shopCustomerData, searchText, tierFilter, sortBy]);

  // Search All Customers results
  const searchAllResults = useMemo((): CustomerData[] => {
    return searchAllData?.customers || [];
  }, [searchAllData]);

  // Customer counts
  const myCustomerCount = myCustomers.length;
  const totalMyCustomerCount = shopCustomerData?.customers?.length || 0;
  const searchAllResultCount = searchAllResults.length;
  const searchAllTotalCount = searchAllData?.pagination?.total || 0;

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      if (viewMode === "my-customers") {
        await refetchMyCustomers();
      } else if (hasSearchedAll) {
        await refetchSearchAll();
      }
    } finally {
      setRefreshing(false);
    }
  }, [viewMode, hasSearchedAll, refetchMyCustomers, refetchSearchAll]);

  // Handle search all customers
  const handleSearchAll = useCallback(() => {
    if (searchAllQuery.trim()) {
      setHasSearchedAll(true);
      refetchSearchAll();
    }
  }, [searchAllQuery, refetchSearchAll]);

  // Clear search all
  const clearSearchAll = useCallback(() => {
    setSearchAllQuery("");
    setHasSearchedAll(false);
  }, []);

  // Switch tabs
  const handleTabChange = useCallback((tab: ViewMode) => {
    setViewMode(tab);
    // Clear searches when switching tabs
    if (tab === "my-customers") {
      clearSearchAll();
    } else {
      clearSearch();
    }
  }, [clearSearch, clearSearchAll]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setTierFilter("all");
    setSortBy("recent");
  }, []);

  return {
    // View mode
    viewMode,
    setViewMode: handleTabChange,
    // My Customers data
    myCustomers,
    myCustomerCount,
    totalMyCustomerCount,
    isLoadingMyCustomers,
    myCustomersError,
    // My Customers search
    searchText,
    setSearchText,
    hasSearchQuery,
    clearSearch,
    // My Customers filters
    tierFilter,
    setTierFilter,
    sortBy,
    setSortBy,
    resetFilters,
    // Search All Customers
    searchAllQuery,
    setSearchAllQuery,
    searchAllResults,
    searchAllResultCount,
    searchAllTotalCount,
    isSearchingAll,
    searchAllError,
    hasSearchedAll,
    handleSearchAll,
    clearSearchAll,
    // Refresh
    refreshing,
    handleRefresh,
    // Legacy exports for backwards compatibility
    customers: myCustomers,
    customerCount: myCustomerCount,
    totalCount: totalMyCustomerCount,
    isLoading: viewMode === "my-customers" ? isLoadingMyCustomers : isSearchingAll,
    error: viewMode === "my-customers" ? myCustomersError : searchAllError,
  };
}
