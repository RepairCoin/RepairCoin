import { useCustomer } from "@/shared/customer/useCustomer";

/**
 * Hook for updating customer profile
 */
export const useUpdateCustomerProfileMutation = (walletAddress: string) => {
  const { useUpdateCustomerProfile } = useCustomer();
  return useUpdateCustomerProfile(walletAddress);
};
