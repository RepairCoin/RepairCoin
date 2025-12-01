import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/services/auth.services";
import { useAuthStore } from "@/store/auth.store";
import { router } from "expo-router";
import apiClient from "@/utilities/axios";

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

    const getTokenMutation = useGetToken();

    return useMutation({
      mutationFn: async (address: string) => {
        if (!address) {
          throw new Error("No wallet address provided");
        }
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
              router.push("/register");
            } else {
              if (result.type === "customer") {
                router.push("/customer/tabs/home");
              } else if (result.type === "shop") {
                const active = result.user?.isActive || false;
                if (active) {
                  router.push("/shop/tabs/home");
                } else {
                  router.push("/register/pending");
                }
              } else {
                router.push("/customer/tabs/home");
              }
            }
          }
        }
      },
      onError: (error: any) => {
        console.error("[useConnectWallet] Error:", error);
      },
    });
  };

  const useSplashNavigation = () => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const userProfile = useAuthStore((state) => state.userProfile);
    const userType = useAuthStore((state) => state.userType);
    const accessToken = useAuthStore((state) => state.accessToken);
    const hasHydrated = useAuthStore((state) => state.hasHydrated);
    const logout = useAuthStore((state) => state.logout);

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
        await logout(false);
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

  return {
    useGetToken,
    useGetProfile,
    useConnectWallet,
    useSplashNavigation,
  };
}
