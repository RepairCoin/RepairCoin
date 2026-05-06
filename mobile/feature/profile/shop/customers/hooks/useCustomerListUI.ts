import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { CustomerData } from "@/shared/interfaces/customer.interface";
import { useShopCustomersQuery, useSearchAllCustomersQuery } from "@/feature/profile/customer/profile/hooks/queries/useCustomerQueries";
import { useCustomerSearch } from "@/feature/profile/customer/profile/hooks/ui/useCustomerSearch";
import { ViewMode, TierFilter, SortBy } from "../types";

export function useCustomerListUI() {
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("my-customers");
  const [searchAllQuery, setSearchAllQuery] = useState("");
  const [hasSearchedAll, setHasSearchedAll] = useState(false);
  const [searchAllPage, setSearchAllPage] = useState(1);
  const [accumulatedResults, setAccumulatedResults] = useState<CustomerData[]>([]);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");

  const { searchText, setSearchText, debouncedSearchText, hasSearchQuery, clearSearch } = useCustomerSearch();

  const { data: shopCustomerData, isLoading: isLoadingMyCustomers, error: myCustomersError, refetch: refetchMyCustomers } = useShopCustomersQuery();

  const {
    data: searchAllData,
    isLoading: isSearchingAll,
    error: searchAllError,
    refetch: refetchSearchAll,
    isFetching: isFetchingSearchAll,
  } = useSearchAllCustomersQuery(searchAllQuery, hasSearchedAll, searchAllPage);

  const prevDataRef = useRef(searchAllData);
  
  useEffect(() => {
    if (searchAllData && searchAllData !== prevDataRef.current) {
      prevDataRef.current = searchAllData;
      const newCustomers = searchAllData?.customers || [];
      if (searchAllPage === 1) {
        setAccumulatedResults(newCustomers);
      } else {
        setAccumulatedResults((prev) => [...prev, ...newCustomers]);
      }
    }
  }, [searchAllData, searchAllPage]);

  const myCustomers = useMemo((): CustomerData[] => {
    let customers = shopCustomerData?.customers || [];

    if (debouncedSearchText.trim()) {
      const query = debouncedSearchText.toLowerCase();
      customers = customers.filter((customer: CustomerData) =>
        customer?.name?.toLowerCase().includes(query) ||
        customer?.address?.toLowerCase().includes(query)
      );
    }

    if (tierFilter !== "all") {
      customers = customers.filter((customer: CustomerData) =>
        customer?.tier?.toLowerCase() === tierFilter
      );
    }

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
  }, [shopCustomerData, debouncedSearchText, tierFilter, sortBy]);

  const myCustomerCount = myCustomers.length;
  const totalMyCustomerCount = shopCustomerData?.customers?.length || 0;
  const searchAllResultCount = accumulatedResults.length;
  const searchAllTotalCount = searchAllData?.pagination?.total || 0;
  const hasMoreSearchResults = searchAllResultCount < searchAllTotalCount;

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      if (viewMode === "my-customers") {
        await refetchMyCustomers();
      } else if (hasSearchedAll) {
        setSearchAllPage(1);
        setAccumulatedResults([]);
        await refetchSearchAll();
      }
    } finally {
      setRefreshing(false);
    }
  }, [viewMode, hasSearchedAll, refetchMyCustomers, refetchSearchAll]);

  const handleSearchAll = useCallback(() => {
    if (searchAllQuery.trim()) {
      setSearchAllPage(1);
      setAccumulatedResults([]);
      setHasSearchedAll(true);
      refetchSearchAll();
    }
  }, [searchAllQuery, refetchSearchAll]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreSearchResults && !isFetchingSearchAll) {
      setSearchAllPage((prev) => prev + 1);
    }
  }, [hasMoreSearchResults, isFetchingSearchAll]);

  const clearSearchAll = useCallback(() => {
    setSearchAllQuery("");
    setHasSearchedAll(false);
    setSearchAllPage(1);
    setAccumulatedResults([]);
  }, []);

  const handleTabChange = useCallback((tab: ViewMode) => {
    setViewMode(tab);
    if (tab === "my-customers") {
      clearSearchAll();
    } else {
      clearSearch();
    }
  }, [clearSearch, clearSearchAll]);

  const resetFilters = useCallback(() => {
    setTierFilter("all");
    setSortBy("recent");
  }, []);

  return {
    viewMode,
    setViewMode: handleTabChange,
    myCustomers,
    myCustomerCount,
    totalMyCustomerCount,
    isLoadingMyCustomers,
    myCustomersError,
    searchText,
    setSearchText,
    hasSearchQuery,
    clearSearch,
    tierFilter,
    setTierFilter,
    sortBy,
    setSortBy,
    resetFilters,
    searchAllQuery,
    setSearchAllQuery,
    searchAllResults: accumulatedResults,
    searchAllResultCount,
    searchAllTotalCount,
    isSearchingAll,
    searchAllError,
    hasSearchedAll,
    handleSearchAll,
    clearSearchAll,
    hasMoreSearchResults,
    isLoadingMore: isFetchingSearchAll && searchAllPage > 1,
    handleLoadMore,
    refreshing,
    handleRefresh,
    customers: myCustomers,
    customerCount: myCustomerCount,
    totalCount: totalMyCustomerCount,
    isLoading: viewMode === "my-customers" ? isLoadingMyCustomers : isSearchingAll,
    error: viewMode === "my-customers" ? myCustomersError : searchAllError,
  };
}
