import { useCustomer } from "@/hooks/customer/useCustomer";

/**
 * Hook for updating customer profile
 */
export const useUpdateCustomerProfileMutation = (walletAddress: string) => {
  const { useUpdateCustomerProfile } = useCustomer();
  return useUpdateCustomerProfile(walletAddress);
};
