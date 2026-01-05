import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { shopApi } from "@/services/shop.services";
import { queryKeys } from "@/config/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { CustomerData } from "@/interfaces/customer.interface";

export function useShopCustomer() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");

  const {
    data: shopCustomerData,
    isLoading,
    error,
    refetch: refetchShopCustomer,
  } = useQuery({
    queryKey: queryKeys.shopCustomers(shopId),
    queryFn: async () => {
      const response = await shopApi.getShopCustomers(shopId);
      return response?.data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

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

  // Customer count
  const customerCount = customers.length;
  const totalCount = shopCustomerData?.customers?.length || 0;

  // Check if search is active
  const hasSearchQuery = searchText.trim().length > 0;

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetchShopCustomer();
    } finally {
      setRefreshing(false);
    }
  }, [refetchShopCustomer]);

  const clearSearch = useCallback(() => {
    setSearchText("");
  }, []);

  return {
    // Data
    customers,
    customerCount,
    totalCount,
    // Search
    searchText,
    setSearchText,
    hasSearchQuery,
    clearSearch,
    // Query state
    isLoading,
    error,
    refreshing,
    handleRefresh,
  };
}
