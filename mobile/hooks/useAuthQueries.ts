import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { queryKeys } from "@/config/queryClient";
import {
  getAuthCustomer,
  registerAsShop,
  ShopRegistrationFormData,
} from "@/services/authServices";

// Legacy - keeping for backward compatibility if needed
// All auth state is now managed by Zustand store (authStore.ts)

export const useAuthCustomer = (address: string) => {
  return useQuery({
    queryKey: queryKeys.auth(),
    queryFn: async () => {
      if (!address) {
        return null; // Return null instead of undefined when no address
      }
      const response = await getAuthCustomer(address);
      return response?.data || null; // Ensure we always return a value, never undefined
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook to handle logout
export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      logout();
      router.replace("/onboarding1");
    },
  });
};

// Hook for connecting wallet using Zustand store
export const useConnectWallet = () => {
  const connectWallet = useAuthStore((state) => state.connectWallet);
  const isCustomer = useAuthStore((state) => state.isCustomer);
  const isShop = useAuthStore((state) => state.isShop);
  const profile = useAuthStore((state) => state.userProfile);

  return useMutation({
    mutationFn: async (address: string) => {
      if (!address) {
        throw new Error("No wallet address provided");
      }
      return await connectWallet(address);
    },
    onSuccess: (result) => {
      if (result.success) {
        if (result.needsRegistration) {
          // User needs to register
          router.push("/register");
        } else {
          // User is authenticated, navigate to dashboard
          if (isCustomer) {
            router.push("/customer/tabs/home");
          } else if (isShop) {
            const active = profile?.isActive || false;
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
    },
    onError: (error: any) => {
      console.error("[useConnectWallet] Error:", error);
    },
  });
};

// Hook for splash screen navigation using Zustand store
export const useSplashNavigation = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isCustomer = useAuthStore((state) => state.isCustomer);
  const isShop = useAuthStore((state) => state.isShop);
  const checkStoredAuth = useAuthStore((state) => state.checkStoredAuth);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Check stored auth on mount
  const { mutate: checkAuth, isPending } = useMutation({
    mutationFn: checkStoredAuth,
  });

  // Determine navigation route
  const getNavigationRoute = () => {
    const profile = useAuthStore((state) => state.userProfile);

    if (isPending || isLoading) {
      return null; // Still checking
    }

    if (isAuthenticated) {
      // User is authenticated, go to appropriate dashboard
      if (isCustomer) {
        return "/customer/tabs/home";
      } else if (isShop) {
        const active = profile?.isActive || false;
        if (active) {
          return "/shop/tabs/home";
        } else {
          return "/register/pending";
        }
      } else {
        return null;
      }
    } else {
      // Not authenticated, go to onboarding
      return "/onboarding1";
    }
  };

  return {
    checkAuth,
    isLoading: isPending || isLoading,
    isAuthenticated,
    navigationRoute: getNavigationRoute(),
  };
};

export const useRegisterShop = () => {
  const login = useAuthStore((state) => state.login);

  return useMutation({
    mutationFn: async (formData: ShopRegistrationFormData) => {
      if (!formData.walletAddress) {
        throw new Error("No wallet address provided");
      }

      // Pass the form data directly to registerAsShop
      return await registerAsShop(formData);
    },
    onSuccess: async (result) => {
      if (result.success) {
        // Login the shop after successful registration
        await login();
        router.push("/shop/tabs/home");
      }
    },
    onError: (error: any) => {
      console.error("[useRegisterShop] Error:", error);
      throw error;
    },
  });
};
