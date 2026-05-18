import { useMemo } from "react";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useCustomer } from "@/feature/customer/profile/hooks/useCustomer";
import { TransactionData } from "@/feature/customer/profile/services/customer.interface";
import { useTokenBalance } from "./useRedeemQuery";

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
