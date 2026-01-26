import { queryClient, queryKeys } from "@/config/queryClient";
import { CustomerFormData, TransactionResponse } from "@/interfaces/customer.interface";
import { customerApi } from "@/shared/services/customer.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import apiClient from "@/utilities/axios";
import { router } from "expo-router";

export const useCustomer = () => {
  const useGetCustomerByWalletAddress = (address: string) => {
    return useQuery({
      queryKey: queryKeys.customerProfile(address),
      queryFn: async () => {
        const response: any =
          await customerApi.getCustomerByWalletAddress(address);
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useGetTransactionsByWalletAddress = (
    address: string,
    limit: number
  ) => {
    return useQuery({
      queryKey: queryKeys.customerTransactions(address),
      queryFn: async () => {
        const response: TransactionResponse = await customerApi.getTransactionByWalletAddress(
          address,
          limit
        );
        console.log("responseresponse: ", response)
        return response.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useRegisterCustomer = () => {
    const setUserProfile = useAuthStore((state) => state.setUserProfile);
    const setAccessToken = useAuthStore((state) => state.setAccessToken);
    const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
    const setUserType = useAuthStore((state) => state.setUserType);
    const { useGetToken } = useAuth();

    const getTokenMutation = useGetToken();

    return useMutation({
      mutationFn: async (formData: CustomerFormData) => {
        return await customerApi.register(formData);
      },
      onSuccess: async (result) => {
        if (result.success) {
          const getTokenResult = await getTokenMutation.mutateAsync(
            result.user?.walletAddress
          );
          if (getTokenResult.success) {
            setUserProfile(result.user);
            setAccessToken(getTokenResult.token);
            setRefreshToken(getTokenResult.refreshToken);
            setUserType(result.type);
            apiClient.setAuthToken(getTokenResult.token);

            router.push("/register/customer/Success");
          }
        }
      },
      onError: (error: any) => {
        console.error("[useRegisterShop] Error:", error);
        throw error;
      },
    });
  };

  const useUpdateCustomerProfile = (address: string) => {
    return useMutation({
      mutationFn: async (updates: { name?: string; email?: string; phone?: string }) => {
        const response = await customerApi.update(address, updates);
        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.customerProfile(address),
        });
      },
    });
  };

  return {
    useGetCustomerByWalletAddress,
    useGetTransactionsByWalletAddress,
    useRegisterCustomer,
    useUpdateCustomerProfile
  };
};
