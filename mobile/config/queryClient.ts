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

  // Customer related
  customers: () => [...queryKeys.all, 'customers'] as const,
  customer: (walletAddress: string) => [...queryKeys.customers(), walletAddress] as const,
  customerProfile: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'profile'] as const,
  customerTransactions: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'transactions'] as const,
  customerRedemptions: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'redemptions'] as const,
  customerTier: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'tier'] as const,
  customerReferrals: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'referrals'] as const,
  earningHistory: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'earningHistory'] as const,
  customerInfo: (walletAddress: string) => [...queryKeys.customer(walletAddress), 'info'] as const,

  // Shop related
  shops: () => [...queryKeys.all, 'shops'] as const,
  shopList: () => [...queryKeys.shops(), 'list'] as const,
  shopByWalletAddress: (walletAddress: string) => [...queryKeys.shops(), 'wallet', walletAddress] as const,
  shop: (id: string) => [...queryKeys.shops(), 'detail', id] as const,
  shopProfile: (id: string) => [...queryKeys.shop(id), 'profile'] as const,
  shopTransactions: (id: string) => [...queryKeys.shop(id), 'transactions'] as const,
  shopCustomerGrowth: (id: string) => [...queryKeys.shop(id), 'customerGrowth'] as const,
  shopCustomers: (id: string) => [...queryKeys.shop(id), 'customers'] as const,
  shopPromoCodes: (shopId: string) => [...queryKeys.shops(), 'promoCodes', shopId] as const,
  shopAnalytics: (shopId: string, timeRange: string) =>
    [...queryKeys.shops(), 'analytics', shopId, timeRange] as const,
  nearbyShops: (coordinates: { lat: number; lng: number }) =>
    [...queryKeys.shops(), 'nearby', coordinates] as const,

  // Redemption related
  redemptions: () => [...queryKeys.all, 'redemptions'] as const,
  redemptionSession: (sessionId: string) => [...queryKeys.redemptions(), 'session', sessionId] as const,
  redemptionSessions: (walletAddress: string) => [...queryKeys.redemptions(), 'sessions', walletAddress] as const,

  // Token related
  tokens: () => [...queryKeys.all, 'tokens'] as const,
  tokenBalance: (address: string) => [...queryKeys.tokens(), 'balance', address] as const,
  tokenTransactions: (address: string, options?: { limit?: number; offset?: number }) =>
    [...queryKeys.tokens(), 'transactions', address, options] as const,
  tokenStats: () => [...queryKeys.tokens(), 'stats'] as const,
  tokenPrice: () => [...queryKeys.tokens(), 'price'] as const,
  tokenEligibility: (address: string, shopId: string, amount: number) =>
    [...queryKeys.tokens(), 'eligibility', address, shopId, amount] as const,
  tokenEarningOpportunities: (address: string) => [...queryKeys.tokens(), 'earning', address] as const,
  tokenTransactionDetails: (hash: string) => [...queryKeys.tokens(), 'transaction', hash] as const,
  tokenGasEstimate: (type: string, amount: number) => [...queryKeys.tokens(), 'gas', type, amount] as const,
  rcnBalance: (address: string) => [...queryKeys.tokens(), 'rcn', address] as const,

  // Auth related
  auth: () => [...queryKeys.all, 'auth'] as const,
  authUser: () => [...queryKeys.auth(), 'user'] as const,
  authSession: () => [...queryKeys.auth(), 'session'] as const,

  // Service related
  services: () => [...queryKeys.all, 'services'] as const,
  serviceList: (filters?: { category?: string; shopId?: string }) =>
    [...queryKeys.services(), 'list', filters] as const,
  serviceTrending: (options?: { limit?: number; days?: number }) =>
    [...queryKeys.services(), 'trending', options] as const,
  shopServices: (filters: { shopId: string; page?: number; limit?: number }) =>
    [...queryKeys.services(), 'shop', filters.shopId, filters] as const,
  service: (id: string) => [...queryKeys.services(), 'detail', id] as const,
  serviceFavorites: (options?: { page?: number; limit?: number }) =>
    [...queryKeys.services(), 'favorites', options] as const,
  serviceFavoriteCheck: (serviceId: string) =>
    [...queryKeys.services(), 'favorites', 'check', serviceId] as const,

  // Booking related
  bookings: () => [...queryKeys.all, 'bookings'] as const,
  shopBookings: (filters?: BookingFilters) => [...queryKeys.bookings(), 'shop', filters] as const,
  customerBookings: (filters?: BookingFilters) => [...queryKeys.bookings(), 'customer', filters] as const,

  // Gift Token / Transfer related
  transfers: () => [...queryKeys.all, 'transfers'] as const,
  transferHistory: (address: string, options?: { limit?: number; offset?: number }) =>
    [...queryKeys.transfers(), 'history', address, options] as const,
  transferValidation: (fromAddress: string, toAddress: string, amount: number) =>
    [...queryKeys.transfers(), 'validate', fromAddress, toAddress, amount] as const,

  // Appointment related
  appointments: () => [...queryKeys.all, 'appointments'] as const,
  availableTimeSlots: (shopId: string, serviceId: string, date: string) =>
    [...queryKeys.appointments(), 'timeSlots', shopId, serviceId, date] as const,
  shopAvailability: (shopId: string) => [...queryKeys.appointments(), 'availability', shopId] as const,
  timeSlotConfig: () => [...queryKeys.appointments(), 'config'] as const,
  dateOverrides: (startDate?: string, endDate?: string) =>
    [...queryKeys.appointments(), 'overrides', { startDate, endDate }] as const,
  shopCalendar: (startDate: string, endDate: string) =>
    [...queryKeys.appointments(), 'calendar', startDate, endDate] as const,
  myAppointments: (startDate: string, endDate: string) =>
    [...queryKeys.appointments(), 'my', startDate, endDate] as const,
} as const;

export type QueryKeys = typeof queryKeys;