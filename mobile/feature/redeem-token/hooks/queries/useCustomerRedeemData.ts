import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useCustomer } from "@/shared/customer/useCustomer";
import { TransactionData } from "@/interfaces/customer.interface";

/**
 * Hook for fetching customer data for redeem screen
 */
export const useCustomerRedeemData = () => {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress, useGetTransactionsByWalletAddress } = useCustomer();

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

  const totalBalance =
    (customerData?.customer?.lifetimeEarnings || 0) -
    (customerData?.customer?.totalRedemptions || 0);

  const totalRedeemed = customerData?.customer?.totalRedemptions || 0;

  const recentRedemptions = useMemo(() => {
    if (!transactionData?.transactions) return [];
    return transactionData.transactions
      .filter((t: TransactionData) =>
        ["redeemed", "redemption"].includes(t.type?.toLowerCase())
      )
      .slice(0, 5);
  }, [transactionData]);

  return {
    customerData,
    isLoadingCustomer,
    customerError,
    refetchCustomer,
    transactionData,
    isLoadingTransactions,
    refetchTransactions,
    totalBalance,
    totalRedeemed,
    recentRedemptions,
  };
};
