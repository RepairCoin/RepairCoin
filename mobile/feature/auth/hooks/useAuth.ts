import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/feature/auth/services/auth.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";
import { useCallback, useState } from "react";
import { useAppToast } from "@/shared/hooks/useAppToast";

export function useAuth() {
  const { showError } = useAppToast();

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

        // Handle pending/inactive shop before getting token.
        // - Pending: never verified by admin (verified=false)
        // - Suspended: was verified, then deactivated (verified=true, active=false,
        //   typically with suspendedAt/suspensionReason populated)
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
            isSuspended ? "/register/suspended" : "/register/pending"
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
            console.error("[useConnectWallet] Token result not successful:", getTokenResult);
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
              isSuspended ? "/register/suspended" : "/register/pending"
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

  const useSplashNavigation = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const userProfile = useAuthStore((state) => state.userProfile);
    const userType = useAuthStore((state) => state.userType);
    const accessToken = useAuthStore((state) => state.accessToken);
    const hasHydrated = useAuthStore((state) => state.hasHydrated);
    const account = useAuthStore((state) => state.account);
    const setAccount = useAuthStore((state) => state.setAccount);

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

      // Self-heal: reconstruct account from userProfile if account is null
      // (happens when persisted state from an older build only has userProfile)
      if (!account && (userProfile?.walletAddress || userProfile?.address)) {
        const addr = userProfile.walletAddress || userProfile.address;
        console.log("[Auth] Self-healing: reconstructing account from userProfile", addr);
        setAccount({ address: addr, email: userProfile.email });
      }

      // Restore token to axios client
      apiClient.setAuthToken(accessToken);

      // Navigate based on user type
      if (userType === "customer") {
        router.replace("/customer/tabs/home");
      } else if (userType === "shop") {
        const isActive =
          userProfile?.isActive ?? userProfile?.active;
        const isApprovedShop = userProfile?.verified && isActive !== false;
        if (isApprovedShop) {
          router.replace("/shop/tabs/home");
        } else {
          const isSuspended =
            !!userProfile?.suspendedAt ||
            !!userProfile?.suspended_at ||
            (userProfile?.verified && isActive === false);
          router.replace(
            isSuspended ? "/register/suspended" : "/register/pending"
          );
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
