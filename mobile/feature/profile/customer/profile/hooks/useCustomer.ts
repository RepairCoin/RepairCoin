import { queryClient, queryKeys } from "@/shared/config/queryClient";
import {
  CustomerFormData,
  TransactionResponse,
} from "@/shared/interfaces/customer.interface";
import { customerApi } from "../services/customer.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useMutation, useQuery } from "@tanstack/react-query";
import apiClient from "@/shared/utilities/axios";
import { router } from "expo-router";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { useGetToken } from "@/feature/auth/hooks/useAuthQuery";

export const useCustomer = () => {
  const { showError } = useAppToast();
  const useGetCustomerByWalletAddress = (address: string) => {
    return useQuery({
      queryKey: queryKeys.customerProfile(address),
      queryFn: async () => {
        const response: any =
          await customerApi.getCustomerByWalletAddress(address);
        const data = response?.data || response;
        // Map snake_case fields
        if (data?.customer) {
          data.customer.profileImageUrl =
            data.customer.profileImageUrl ||
            data.customer.profile_image_url ||
            null;
          data.customer.currentRcnBalance =
            data.customer.currentRcnBalance ??
            data.customer.current_rcn_balance ??
            0;
        }
        return data;
      },
      enabled: !!address,
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const useGetTransactionsByWalletAddress = (
    address: string,
    limit: number,
  ) => {
    return useQuery({
      queryKey: queryKeys.customerTransactions(address),
      queryFn: async () => {
        const response: TransactionResponse =
          await customerApi.getTransactionByWalletAddress(address, limit);
        console.log("responseresponse: ", response);
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

    const getTokenMutation = useGetToken();

    return useMutation({
      mutationFn: async (formData: CustomerFormData) => {
        return await customerApi.register(formData);
      },
      onSuccess: async (result) => {
        if (result.success) {
          const customerData = result.data;
          const walletAddress =
            customerData?.address || customerData?.walletAddress;

          try {
            const getTokenResult =
              await getTokenMutation.mutateAsync(walletAddress);
            if (getTokenResult.success) {
              setUserProfile(customerData);
              setAccessToken(getTokenResult.token);
              const refreshTk = getTokenResult.data?.refreshToken || getTokenResult.refreshToken || "";
              setRefreshToken(refreshTk);
              setUserType("customer");
              apiClient.setAuthToken(getTokenResult.token);
              router.push("/register/customer/Success");
            }
          } catch (err) {
            console.error("[useRegisterCustomer] Token fetch failed:", err);
            // Still navigate — account was created successfully
            router.push("/register/customer/Success");
          }
        }
      },
      onError: (error: any) => {
        console.error("[useRegisterCustomer] Error:", error);
        if (error?.__toastShown) return;
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Registration failed. Please try again.";
        showError(message);
      },
    });
  };

  const useUpdateCustomerProfile = (address: string) => {
    return useMutation({
      mutationFn: async (updates: {
        name?: string;
        email?: string;
        phone?: string;
        profile_image_url?: string;
      }) => {
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
    useUpdateCustomerProfile,
  };
};
