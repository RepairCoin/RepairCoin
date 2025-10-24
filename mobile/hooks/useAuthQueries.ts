import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkUserByWalletAddress } from '../services/authServices';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface AuthUser {
  address: string;
  userType: 'customer' | 'shop';
  isAuthenticated: boolean;
}

interface LoginCredentials {
  walletAddress: string;
  signature?: string;
  userType: 'customer' | 'shop';
}

const logoutUser = async (): Promise<void> => {
  await Promise.all([
    AsyncStorage.removeItem('authToken'),
    AsyncStorage.removeItem('userType'),
    AsyncStorage.removeItem('walletAddress'),
  ]);
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      
      // Reset auth state
      queryClient.setQueryData(queryKeys.authUser(), null);
    },
  });
};

// Mutation for checking wallet and handling navigation
export const useConnectWallet = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (address: string) => {
      if (!address) {
        throw new Error('No wallet address provided');
      }
      return await checkUserByWalletAddress(address);
    },
    onSuccess: (response, address) => {
      // Cache the result
      queryClient.setQueryData(['wallet-connection', address], response);
      
      // Handle navigation based on response
      if (response?.exists && response?.user) {
        if (response?.type === 'customer') {
          router.push("/dashboard/customer");
        } else if (response?.type === 'shop') {
          // TODO: Add shop dashboard when available
          router.push("/dashboard/customer");
        }
      } else {
        console.log('[useConnectWallet] No user found for address:', address);
      }
    },
    onError: (error: any) => {
      if (error?.response?.status === 404) {
        router.push("/auth/register");
      } else {
        console.error('[useConnectWallet] Error checking user:', error);
      }
    },
  });
};