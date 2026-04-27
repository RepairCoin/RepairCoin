import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/feature/auth/services/auth.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";
import { useCallback, useState } from "react";
import { useAppToast } from "@/shared/hooks/useAppToast";

export const useGetToken = () => {
  return useMutation({
    mutationFn: async (address: string) => {
      return await authApi.getToken(address);
    },
    onError: (error) => {
      console.log("[useGetToken] Error:", error);
    },
  });
};

export const useGetProfile = () => {
  return useMutation({
    mutationFn: async (address: string) => {
      return await authApi.checkUserExists(address);
    },
    onError: (error) => {
      console.log("[useCheckUserExists] Error:", error);
    },
  });
};

export const useConnectWallet = () => {
  const setAccount = useAuthStore((state) => state.setAccount);
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
  const setUserType = useAuthStore((state) => state.setUserType);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);
  const { showError } = useAppToast();

  const getTokenMutation = useGetToken();

  return useMutation({
    mutationFn: async (params: { address: string; email?: string }) => {
      const { address, email } = params;
      if (!address) {
        throw new Error("No wallet address provided");
      }
      setIsLoading(true);
      setAccount({ address, email });

      return await authApi.checkUserExists(address);
    },
    onSuccess: async (result, params) => {
      const { address } = params;
      if (!result.exists) {
        router.replace("/register");
        setTimeout(() => setIsLoading(false), 500);
        return;
      }
      
      if (
        result.type === "shop" &&
        (!result.user?.verified || !result.user?.active)
      ) {
        setUserProfile(result.user);
        setUserType("shop");
        const isActive = result.user?.isActive ?? result.user?.active;
        const isSuspended =
          !!result.user?.suspendedAt ||
          !!result.user?.suspended_at ||
          (result.user?.verified && !isActive);
        router.replace(
          isSuspended ? "/register/suspended" : "/register/pending",
        );
        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      try {
        const getTokenResult = await getTokenMutation.mutateAsync(address);
        if (getTokenResult.success) {
          setUserProfile(result.user);
          setAccessToken(getTokenResult.token);
          setRefreshToken(
            getTokenResult.data?.refreshToken || getTokenResult.refreshToken,
          );
          setUserType(result.type);
          apiClient.setAuthToken(getTokenResult.token);

          if (result.type === "customer") {
            router.replace("/customer/tabs/home");
          } else if (result.type === "shop") {
            router.replace("/shop/tabs/home");
          } else {
            router.replace("/customer/tabs/home");
          }
        } else {
          console.error(
            "[useConnectWallet] Token result not successful:",
            getTokenResult,
          );
          showError("Could not complete sign-in. Please try again.");
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("[useConnectWallet] Token error:", err);
        // If token fails for a shop, it might be unverified or suspended
        if (result.type === "shop") {
          setUserProfile(result.user);
          setUserType("shop");
          const isActive = result.user?.isActive ?? result.user?.active;
          const isSuspended =
            !!result.user?.suspendedAt ||
            !!result.user?.suspended_at ||
            (result.user?.verified && !isActive);
          router.replace(
            isSuspended ? "/register/suspended" : "/register/pending",
          );
          setTimeout(() => setIsLoading(false), 500);
        } else {
          if (!err?.__toastShown) {
            showError("Could not complete sign-in. Please try again.");
          }
          setIsLoading(false);
        }
      }
    },
    onError: (error: any) => {
      console.error("[useConnectWallet] Error:", error);

      // Check if user not found - redirect to register
      if (error?.response?.status === 404 || error?.status === 404) {
        console.log(
          "[useConnectWallet] User not found, redirecting to register...",
        );
        router.replace("/register");
        // Keep isLoading true until navigation completes to prevent onboarding flash
        setTimeout(() => setIsLoading(false), 500);
        return;
      }

      setIsLoading(false);

      // Show user-facing error unless the axios interceptor already did
      if (!error?.__toastShown) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Something went wrong. Please try again.";
        showError(message);
      }
    },
  });
};

