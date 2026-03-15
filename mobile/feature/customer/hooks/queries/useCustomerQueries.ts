import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { shopApi } from "@/shared/services/shop.services";
import { customerApi } from "@/shared/services/customer.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { CustomerData } from "@/shared/interfaces/customer.interface";

// Helper to get numeric value, properly handling 0 vs null/undefined
const getNumericValue = (snakeCase: any, camelCase: any, defaultValue: number = 0): number => {
  if (snakeCase !== undefined && snakeCase !== null) return Number(snakeCase);
  if (camelCase !== undefined && camelCase !== null) return Number(camelCase);
  return defaultValue;
};

// Helper to get string value, properly handling empty strings
const getStringValue = (snakeCase: any, camelCase: any, defaultValue: string = ""): string => {
  if (snakeCase !== undefined && snakeCase !== null) return String(snakeCase);
  if (camelCase !== undefined && camelCase !== null) return String(camelCase);
  return defaultValue;
};

// Transform snake_case API response to camelCase for frontend
const transformCustomer = (customer: any): CustomerData => ({
  ...customer,
  lifetimeEarnings: getNumericValue(customer.lifetime_earnings, customer.lifetimeEarnings, 0),
  totalRedemptions: getNumericValue(customer.total_redemptions, customer.totalRedemptions, 0),
  totalRepairs: getNumericValue(customer.total_repairs, customer.totalRepairs, 0),
  referralCode: getStringValue(customer.referral_code, customer.referralCode, ""),
  referralCount: getNumericValue(customer.referral_count, customer.referralCount, 0),
  dailyEarnings: getNumericValue(customer.daily_earnings, customer.dailyEarnings, 0),
  monthlyEarnings: getNumericValue(customer.monthly_earnings, customer.monthlyEarnings, 0),
  joinDate: getStringValue(customer.join_date, customer.joinDate, ""),
  isActive: customer.is_active ?? customer.isActive ?? true,
  isSuspended: customer.is_suspended ?? customer.isSuspended ?? false,
  suspensionReason: customer.suspension_reason ?? customer.suspensionReason ?? null,
  total_transactions: getNumericValue(customer.total_transactions, undefined, 0),
  last_transaction_date: getStringValue(customer.last_transaction_date, undefined, ""),
});

export function useShopCustomersQuery() {
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId || "";

  return useQuery({
    queryKey: queryKeys.shopCustomers(shopId),
    queryFn: async () => {
      const response = await shopApi.getShopCustomers(shopId);
      const data = response?.data;

      // Transform customers to ensure camelCase properties
      if (data?.customers) {
        data.customers = data.customers.map(transformCustomer);
      }

      return data;
    },
    enabled: !!shopId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useSearchAllCustomersQuery(searchQuery: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ["searchAllCustomers", searchQuery],
    queryFn: async () => {
      const response = await customerApi.searchAllCustomers(searchQuery);
      const data = response?.data;

      // Transform customers to ensure camelCase properties
      if (data?.customers) {
        data.customers = data.customers.map(transformCustomer);
      }

      return data;
    },
    enabled: enabled && !!searchQuery.trim(),
    staleTime: 5 * 60 * 1000,
  });
}
