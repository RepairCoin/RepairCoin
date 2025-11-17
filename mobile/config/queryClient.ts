import { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: any) => {
          if (error?.status === 404 || error?.status === 401) {
            return false;
          }
          return failureCount < 3;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
        networkMode: 'offlineFirst',
      },
      mutations: {
        retry: (failureCount, error: any) => {
          if (error?.status === 404 || error?.status === 401 || error?.status === 403) {
            return false;
          }
          return failureCount < 2;
        },
        networkMode: 'offlineFirst',
      },
    },
  });
};

export const queryClient = createQueryClient();

export const queryKeys = {
  all: ['repaircoin'] as const,
  
  // Customer related (primary focus)
  customers: () => [...queryKeys.all, 'customers'] as const,
  customer: (id: string) => [...queryKeys.customers(), id] as const,
  customerProfile: (id: string) => [...queryKeys.customer(id), 'profile'] as const,
  customerTransactions: (id: string) => [...queryKeys.customer(id), 'transactions'] as const,
  customerRedemptions: (id: string) => [...queryKeys.customer(id), 'redemptions'] as const,
  customerTier: (id: string) => [...queryKeys.customer(id), 'tier'] as const,
  customerReferrals: (id: string) => [...queryKeys.customer(id), 'referrals'] as const,
  earningHistory: (address: string) => [...queryKeys.customer(address), 'earningHistory'] as const,
  
  // Shop related (for future development)
  shops: () => [...queryKeys.all, 'shops'] as const,
  shopByWalletAddress: (walletAddress: string) => [...queryKeys.shops(), walletAddress] as const,
  shop: (id: string) => [...queryKeys.shops(), id] as const,
  shopProfile: (id: string) => [...queryKeys.shop(id), 'profile'] as const,
  shopTransactions: (id: string) => [...queryKeys.shop(id), 'transactions'] as const,
  nearbyShops: (coordinates: { lat: number; lng: number }) => 
    [...queryKeys.shops(), 'nearby', coordinates] as const,
  
  // Token related
  tokens: () => [...queryKeys.all, 'tokens'] as const,
  tokenBalance: (address: string) => [...queryKeys.tokens(), 'balance', address] as const,
  tokenPrice: (symbol: string) => [...queryKeys.tokens(), 'price', symbol] as const,
  rcnBalance: (address: string) => [...queryKeys.tokens(), 'rcn', address] as const,
  
  // Auth related (customer and shop only)
  auth: () => [...queryKeys.all, 'auth'] as const,
  authUser: () => [...queryKeys.auth(), 'user'] as const,
  authSession: () => [...queryKeys.auth(), 'session'] as const,
} as const;

export type QueryKeys = typeof queryKeys;