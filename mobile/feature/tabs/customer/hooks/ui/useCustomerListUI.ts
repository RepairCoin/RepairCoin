import { useState, useCallback, useMemo } from "react";
import { CustomerData } from "@/shared/interfaces/customer.interface";
import { useShopCustomersQuery } from "../queries/useCustomerQueries";
import { useCustomerSearch } from "./useCustomerSearch";

export function useCustomerListUI() {
  const [refreshing, setRefreshing] = useState(false);

  // Search
  const { searchText, setSearchText, hasSearchQuery, clearSearch } = useCustomerSearch();

  // Query
  const { data: shopCustomerData, isLoading, error, refetch } = useShopCustomersQuery();

  // Filter customers by search text
  const customers = useMemo((): CustomerData[] => {
    const allCustomers = shopCustomerData?.customers || [];

    if (!searchText.trim()) {
      return allCustomers;
    }

    const query = searchText.toLowerCase();
    return allCustomers.filter((customer: CustomerData) =>
      customer?.name?.toLowerCase().includes(query)
    );
  }, [shopCustomerData, searchText]);

  // Customer counts
  const customerCount = customers.length;
  const totalCount = shopCustomerData?.customers?.length || 0;

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return {
    // Data
    customers,
    customerCount,
    totalCount,
    // Query state
    isLoading,
    error,
    // Refresh
    refreshing,
    handleRefresh,
    // Search
    searchText,
    setSearchText,
    hasSearchQuery,
    clearSearch,
  };
}
