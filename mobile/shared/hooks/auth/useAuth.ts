import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/shared/services/auth.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { router } from "expo-router";
import apiClient from "@/utilities/axios";
import { useCallback, useState } from "react";

export function useAuth() {
  const useGetToken = () => {
    return useMutation({
      mutationFn: async (address: string) => {
        return await authApi.getToken(address);
      },
      onError: (error) => {
        console.log("[useGetToken] Error:", error);
      },
    });
  };

  const useGetProfile = () => {
    return useMutation({
      mutationFn: async (address: string) => {
        return await authApi.checkUserExists(address);
      },
      onError: (error) => {
        console.log("[useCheckUserExists] Error:", error);
      },
    });
  };

  const useConnectWallet = () => {
    const setAccount = useAuthStore((state) => state.setAccount);
    const setUserProfile = useAuthStore((state) => state.setUserProfile);
    const setAccessToken = useAuthStore((state) => state.setAccessToken);
    const setRefreshToken = useAuthStore((state) => state.setRefreshToken);
    const setUserType = useAuthStore((state) => state.setUserType);
    const setIsLoading = useAuthStore((state) => state.setIsLoading);

    const getTokenMutation = useGetToken();

    return useMutation({
      mutationFn: async (address: string) => {
        if (!address) {
          throw new Error("No wallet address provided");
        }
        setIsLoading(true);
        setAccount({ address });

        return await authApi.checkUserExists(address);
      },
      onSuccess: async (result, address) => {
        if (result.exists) {
          const getTokenResult = await getTokenMutation.mutateAsync(address);
          if (getTokenResult.success) {
            setUserProfile(result.user);
            setAccessToken(getTokenResult.token);
            setRefreshToken(getTokenResult.refreshToken);
            setUserType(result.type);
            apiClient.setAuthToken(getTokenResult.token);

            if (!result.exists) {
              setIsLoading(false);
              router.replace("/register");
            } else {
              if (result.type === "customer") {
                router.replace("/customer/tabs/home");
              } else if (result.type === "shop") {
                const active = result.user?.isActive || false;
                if (active) {
                  router.replace("/shop/tabs/home");
                } else {
                  router.replace("/register/pending");
                }
              } else {
                router.replace("/customer/tabs/home");
              }
            }
          } else {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      },
      onError: (error: any) => {
        console.error("[useConnectWallet] Error:", error);
        setIsLoading(false);

        // Check if user not found - redirect to register
        if (error?.response?.status === 404 || error?.status === 404) {
          console.log("[useConnectWallet] User not found, redirecting to register...");
          router.replace("/register");
          return;
        }
      },
    });
  };

  const useSplashNavigation = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const userProfile = useAuthStore((state) => state.userProfile);
    const userType = useAuthStore((state) => state.userType);
    const accessToken = useAuthStore((state) => state.accessToken);
    const hasHydrated = useAuthStore((state) => state.hasHydrated);

    const navigate = async () => {
      // Wait for store to hydrate before checking auth
      if (!hasHydrated) {
        console.log("[Auth] Store not hydrated yet, waiting...");
        return;
      }

      console.log("[Auth] isAuthenticated:", isAuthenticated);
      console.log("[Auth] accessToken:", !!accessToken);
      console.log("[Auth] userProfile:", userProfile);

      // Check if we have stored auth data
      if (!isAuthenticated || !userProfile?.address || !accessToken) {
        console.log("[Auth] No stored authentication found");
        router.replace("/onboarding1");
        return;
      }

      // Restore token to axios client
      apiClient.setAuthToken(accessToken);

      // Navigate based on user type
      if (userType === "customer") {
        router.replace("/customer/tabs/home");
      } else if (userType === "shop") {
        const active = userProfile?.isActive || false;
        if (active) {
          router.replace("/shop/tabs/home");
        } else {
          router.replace("/register/pending");
        }
      } else {
        router.replace("/onboarding1");
      }
    };

    return { navigate, isAuthenticated, userProfile, hasHydrated };
  };

  const useLogout = () => {
    const queryClient = useQueryClient();
    const logout = useAuthStore((state) => state.logout);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = useCallback(async () => {
      if (isLoggingOut) return;

      try {
        setIsLoggingOut(true);
        console.log("[Logout] Starting logout process...");

        // 1. Clear all React Query cache
        console.log("[Logout] Clearing React Query cache...");
        queryClient.clear();

        // 2. Cancel any pending queries
        await queryClient.cancelQueries();

        // 3. Remove all queries from cache
        queryClient.removeQueries();

        // 4. Reset query client defaults (optional, ensures clean state)
        queryClient.resetQueries();

        console.log("[Logout] React Query cache cleared");

        // 5. Call the Zustand logout which handles:
        //    - Wallet disconnection
        //    - Clearing axios auth token
        //    - Clearing SecureStore
        //    - Resetting Zustand state
        //    - Navigation to onboarding
        await logout(true);

        console.log("[Logout] Logout completed successfully");
      } catch (error) {
        console.error("[Logout] Error during logout:", error);
        // Still try to navigate even if there's an error
        router.replace("/onboarding1");
      } finally {
        setIsLoggingOut(false);
      }
    }, [queryClient, logout, isLoggingOut]);

    return {
      logout: handleLogout,
      isLoggingOut,
    };
  };

  return {
    useGetToken,
    useGetProfile,
    useConnectWallet,
    useSplashNavigation,
    useLogout,
  };
}
