import { queryKeys } from "@/config/queryClient";
import { customerApi } from "@/services/customer.services";
import { useQuery } from "@tanstack/react-query";

export const useCustomer = () => {
  const useGetCustomerByWalletAddress = (address: string) => {
    return useQuery({
      queryKey: queryKeys.customerProfile(address),
      queryFn: async () => {
        const response: any = await customerApi.getCustomerByWalletAddress(address);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  }

  const useGetTransactionsByWalletAddress = (address: string, limit: number) => {
    return useQuery({
      queryKey: queryKeys.customerTransactions(address),
      queryFn: async () => {
        const response: any = await customerApi.getTransactionByWalletAddress(address, limit);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  }

  return {
    useGetCustomerByWalletAddress,
    useGetTransactionsByWalletAddress
  };
};
