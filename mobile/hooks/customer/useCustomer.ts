import { queryKeys } from "@/config/queryClient";
import { CustomerFormData } from "@/interfaces/customer.interface";
import { customerApi } from "@/services/customer.services";
import { useAuthStore } from "@/store/auth.store";
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
        const response: any = await customerApi.getTransactionByWalletAddress(
          address,
          limit
        );
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

  return {
    useGetCustomerByWalletAddress,
    useGetTransactionsByWalletAddress,
    useRegisterCustomer,
  };
};
