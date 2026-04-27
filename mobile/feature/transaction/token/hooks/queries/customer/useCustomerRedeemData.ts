import { useMemo } from "react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useCustomer } from "@/feature/profile/customer/hooks/useCustomer";
import { TransactionData } from "@/shared/interfaces/customer.interface";
import { useTokenBalance } from "../../useTokenQueries";

/**
 * Hook for fetching customer data for redeem screen
 *
 * Balance values (totalBalance, totalRedeemed) are sourced from the
 * transaction-based /tokens/balance/:address endpoint, matching web.
 * The customers.total_redemptions profile column is stale (not decremented
 * on service_redemption_refund, doesn't include redeem transactions), so we
 * avoid it here. See completed/bug-redeem-token-metrics-diverge-from-web.md.
 */
export const useCustomerRedeemData = () => {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress, useGetTransactionsByWalletAddress } =
    useCustomer();

  const {
    data: customerData,
    isLoading: isLoadingCustomer,
    error: customerError,
    refetch: refetchCustomer,
  } = useGetCustomerByWalletAddress(account?.address);

  const {
    data: transactionData,
    isLoading: isLoadingTransactions,
    refetch: refetchTransactions,
  } = useGetTransactionsByWalletAddress(account?.address, 50);

  const { data: balanceData, refetch: refetchBalance } = useTokenBalance(
    account?.address,
  );

  const totalBalance = balanceData?.availableBalance || 0;
  const totalRedeemed = balanceData?.totalRedeemed || 0;

  const recentRedemptions = useMemo(() => {
    if (!transactionData?.transactions) return [];
    return transactionData.transactions
      .filter((t: TransactionData) =>
        ["redeemed", "redemption"].includes(t.type?.toLowerCase()),
      )
      .slice(0, 5);
  }, [transactionData]);

  const refetchCustomerAndBalance = async () => {
    await Promise.all([refetchCustomer(), refetchBalance()]);
  };

  return {
    customerData,
    isLoadingCustomer,
    customerError,
    refetchCustomer: refetchCustomerAndBalance,
    transactionData,
    isLoadingTransactions,
    refetchTransactions,
    totalBalance,
    totalRedeemed,
    recentRedemptions,
  };
};
