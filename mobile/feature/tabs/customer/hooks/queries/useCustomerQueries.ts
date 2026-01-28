import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config/queryClient";
import { shopApi } from "@/shared/services/shop.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { CustomerData } from "@/shared/interfaces/customer.interface";

// Transform snake_case API response to camelCase for frontend
const transformCustomer = (customer: any): CustomerData => ({
  ...customer,
  lifetimeEarnings: customer.lifetime_earnings ?? customer.lifetimeEarnings ?? 0,
  totalRedemptions: customer.total_redemptions ?? customer.totalRedemptions ?? 0,
  totalRepairs: customer.total_repairs ?? customer.totalRepairs ?? 0,
  referralCode: customer.referral_code ?? customer.referralCode ?? "",
  referralCount: customer.referral_count ?? customer.referralCount ?? 0,
  dailyEarnings: customer.daily_earnings ?? customer.dailyEarnings ?? 0,
  monthlyEarnings: customer.monthly_earnings ?? customer.monthlyEarnings ?? 0,
  joinDate: customer.join_date ?? customer.joinDate ?? "",
  isActive: customer.is_active ?? customer.isActive ?? true,
  isSuspended: customer.is_suspended ?? customer.isSuspended ?? false,
  suspensionReason: customer.suspension_reason ?? customer.suspensionReason ?? null,
  total_transactions: customer.total_transactions ?? 0,
  last_transaction_date: customer.last_transaction_date ?? "",
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
