import { BookingFilters } from '@/interfaces/booking.interfaces';
import { QueryClient } from '@tanstack/react-query';

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
  customer: (walletAddress: string) => [...queryKeys.customers(), walletAddress] as const,
  customerProfile: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'profile'] as const,
  customerTransactions: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'transactions'] as const,
  customerRedemptions: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'redemptions'] as const,
  customerTier: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'tier'] as const,
  customerReferrals: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'referrals'] as const,
  earningHistory: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'earningHistory'] as const,
  
  // Shop related (for future development)
  shops: () => [...queryKeys.all, 'shops'] as const,
  shopByWalletAddress: (walletAddress: string) => [...queryKeys.shops(), walletAddress] as const,
  shop: (id: string) => [...queryKeys.shops(), id] as const,
  shopProfile: (id: string) => [...queryKeys.shop(id), 'profile'] as const,
  shopTransactions: (id: string) => [...queryKeys.shop(id), 'transactions'] as const,
  shopCustomerGrowth: (id: string) => [...queryKeys.shop(id), 'customerGrowth'] as const,
  shopCustomers: (id: string) => [...queryKeys.shop(id), 'customers'] as const,
  nearbyShops: (coordinates: { lat: number; lng: number }) =>
    [...queryKeys.shops(), 'nearby', coordinates] as const,

  // Redemption related
  redemptions: () => [...queryKeys.all, 'redemptions'] as const,
  redemptionSession: (sessionId: string) => [...queryKeys.redemptions(), 'session', sessionId] as const,
  redemptionSessions: (shopId: string) => [...queryKeys.redemptions(), 'sessions', shopId] as const,
  
  // Token related
  tokens: () => [...queryKeys.all, 'tokens'] as const,
  tokenBalance: (address: string) => [...queryKeys.tokens(), 'balance', address] as const,
  tokenPrice: (symbol: string) => [...queryKeys.tokens(), 'price', symbol] as const,
  rcnBalance: (address: string) => [...queryKeys.tokens(), 'rcn', address] as const,
  
  // Auth related (customer and shop only)
  auth: () => [...queryKeys.all, 'auth'] as const,
  authUser: () => [...queryKeys.auth(), 'user'] as const,
  authSession: () => [...queryKeys.auth(), 'session'] as const,

  // Service related
  servicesBase: (shopId: string) => [...queryKeys.all, 'services', shopId] as const,
  services: (shopId: string, options?: { page?: number; limit?: number }) => [...queryKeys.servicesBase(shopId), options] as const,

  // Booking related
  bookings: (filters?: BookingFilters) => [...queryKeys.all, 'bookings', filters] as const,
} as const;

export type QueryKeys = typeof queryKeys;