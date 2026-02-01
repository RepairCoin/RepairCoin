import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { serviceAnalyticsApi, BookingAnalytics } from '@/services/api/serviceAnalytics';

const STALE_TIME = 5 * 60 * 1000;

interface CachedData {
  analytics: BookingAnalytics;
  lastFetched: number;
}

interface BookingAnalyticsState {
  // Per trendDays cached data
  dataByDays: Record<number, CachedData>;

  // UI state
  isRefreshing: boolean;
  error: string | null;
  trendDays: number;

  // Actions
  setTrendDays: (days: number) => void;
  fetchAnalytics: (trendDays: number, force?: boolean) => Promise<void>;
  getData: (trendDays: number) => BookingAnalytics | undefined;
  isDataStale: (trendDays: number) => boolean;
  clearAllData: () => void;
}

export const useBookingAnalyticsStore = create<BookingAnalyticsState>()(
  devtools(
    persist(
      (set, get) => ({
        dataByDays: {},
        isRefreshing: false,
        error: null,
        trendDays: 30,

        setTrendDays: (days: number) => {
          set({ trendDays: days });
        },

        getData: (trendDays: number) => {
          return get().dataByDays[trendDays]?.analytics;
        },

        isDataStale: (trendDays: number) => {
          const cached = get().dataByDays[trendDays];
          if (!cached) return true;
          return Date.now() - cached.lastFetched >= STALE_TIME;
        },

        fetchAnalytics: async (trendDays: number, force: boolean = false) => {
          const state = get();
          const cached = state.dataByDays[trendDays];

          if (cached && !force && Date.now() - cached.lastFetched < STALE_TIME) {
            return;
          }

          if (state.isRefreshing && !force) return;

          set({ isRefreshing: true, error: null });

          try {
            const analytics = await serviceAnalyticsApi.getBookingAnalytics(trendDays);

            set((state) => ({
              dataByDays: {
                ...state.dataByDays,
                [trendDays]: {
                  analytics,
                  lastFetched: Date.now(),
                },
              },
              error: null,
            }));
          } catch (err) {
            console.error('Failed to load booking analytics:', err);
            set({ error: 'Failed to load booking analytics' });
          } finally {
            set({ isRefreshing: false });
          }
        },

        clearAllData: () => {
          set({ dataByDays: {}, error: null });
        },
      }),
      {
        name: 'booking-analytics-store',
        partialize: (state) => ({
          dataByDays: state.dataByDays,
          trendDays: state.trendDays,
        }),
      }
    ),
    { name: 'booking-analytics-store' }
  )
);
