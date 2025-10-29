import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { queryKeys } from '@/config/queryClient';
import { getAuthCustomer } from '@/services/authServices';

// Legacy - keeping for backward compatibility if needed
// All auth state is now managed by Zustand store (authStore.ts)

export const useAuthCustomer = (address: string) => {
  return useQuery({
    queryKey: queryKeys.auth(),
    queryFn: async () => {
      const response = await getAuthCustomer(address);
      console.log("responseresponse: ", response)
      return response.data;
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
      router.replace('/onboarding1');
    },
  });
};

// Hook for connecting wallet using Zustand store
export const useConnectWallet = () => {
  const connectWallet = useAuthStore((state) => state.connectWallet);
  const isCustomer = useAuthStore((state) => state.isCustomer);
  const isShop = useAuthStore((state) => state.isShop);
  
  return useMutation({
    mutationFn: async (address: string) => {
      if (!address) {
        throw new Error('No wallet address provided');
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
            router.push("/dashboard/customer");
          } else if (isShop) {
            // TODO: Add shop dashboard when available
            router.push("/dashboard/customer");
          } else {
            router.push("/dashboard/customer");
          }
        }
      }
    },
    onError: (error: any) => {
      console.error('[useConnectWallet] Error:', error);
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
    if (isPending || isLoading) {
      return null; // Still checking
    }
    
    if (isAuthenticated) {
      // User is authenticated, go to appropriate dashboard
      if (isCustomer) {
        return '/dashboard/customer';
      } else if (isShop) {
        // TODO: Add shop dashboard route when implemented
        return '/dashboard/customer';
      } else {
        return '/dashboard/customer';
      }
    } else {
      // Not authenticated, go to onboarding
      return '/onboarding1';
    }
  };
  
  return {
    checkAuth,
    isLoading: isPending || isLoading,
    isAuthenticated,
    navigationRoute: getNavigationRoute(),
  };
};