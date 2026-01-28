import { useCustomer } from "@/shared/hooks/customer/useCustomer";

/**
 * Hook for fetching customer profile by wallet address
 */
export const useCustomerProfileQuery = (walletAddress: string) => {
  const { useGetCustomerByWalletAddress } = useCustomer();
  return useGetCustomerByWalletAddress(walletAddress);
};
