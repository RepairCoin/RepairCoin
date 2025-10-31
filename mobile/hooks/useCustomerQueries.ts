import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { 
  getCustomerByWalletAddress, 
  getRCNBalanceByWalletAddress,
  getEarningHistoryByWalletAddress,
  CustomerEarningHistoryResponse
} from '../services/customerServices';

export const useCustomer = (address: string) => {
  return useQuery({
    queryKey: queryKeys.customerProfile(address),
    queryFn: async () => {
      const response = await getCustomerByWalletAddress(address);
      return response.data;
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCustomerBalance = (address: string) => {
  return useQuery({
    queryKey: queryKeys.rcnBalance(address),
    queryFn: () => getRCNBalanceByWalletAddress(address),
    enabled: !!address,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};


// Custom hook for customer data with balance
export const useCustomerWithBalance = (address: string) => {
  const customerQuery = useCustomer(address);
  const balanceQuery = useCustomerBalance(address);
  
  return {
    data: {
      customer: customerQuery.data,
      balance: balanceQuery.data,
    },
    isLoading: customerQuery.isLoading || balanceQuery.isLoading,
    isError: customerQuery.isError || balanceQuery.isError,
    error: customerQuery.error || balanceQuery.error,
    refetch: () => {
      customerQuery.refetch();
      balanceQuery.refetch();
    },
  };
};

export const useEarningHistory = (address: string) => {
  return useQuery({
    queryKey: queryKeys.earningHistory(address),
    queryFn: async () => {
      if (!address) {
        return null; // Return null instead of undefined when no address
      }
      const response: CustomerEarningHistoryResponse = await getEarningHistoryByWalletAddress(address);
      return response?.data || null; // Ensure we always return a value, never undefined
    },
    enabled: !!address,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};
