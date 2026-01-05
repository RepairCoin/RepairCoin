import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { shopApi } from "@/services/shop.services";
import { useAuthStore } from "@/store/auth.store";
import { CustomerData } from "@/interfaces/customer.interface";

export function useCustomerQuery(searchText: string) {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";
  const [refreshing, setRefreshing] = useState(false);

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

  // Customer counts
  const customerCount = customers.length;
  const totalCount = shopCustomerData?.customers?.length || 0;

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await refetchShopCustomer();
    } finally {
      setRefreshing(false);
    }
  }, [refetchShopCustomer]);

  return {
    // Data
    customers,
    customerCount,
    totalCount,
    // Query state
    isLoading,
    error,
    refreshing,
    handleRefresh,
  };
}
