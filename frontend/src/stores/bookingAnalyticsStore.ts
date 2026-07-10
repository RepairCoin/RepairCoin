import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { serviceAnalyticsApi, BookingAnalytics } from '@/services/api/serviceAnalytics';

const STALE_TIME = 5 * 60 * 1000;

// Cache is keyed by trend window + branch so switching locations never shows another branch's data.
const cacheKey = (trendDays: number, locationId?: string | null) => `${trendDays}:${locationId ?? 'all'}`;

interface CachedData {
  analytics: BookingAnalytics;
  lastFetched: number;
}

interface BookingAnalyticsState {
  // Cached data keyed by `${trendDays}:${locationId}`
  dataByDays: Record<string, CachedData>;

  // UI state
  isRefreshing: boolean;
  error: string | null;
  trendDays: number;

  // Actions
  setTrendDays: (days: number) => void;
  fetchAnalytics: (trendDays: number, locationId?: string | null, force?: boolean) => Promise<void>;
  getData: (trendDays: number, locationId?: string | null) => BookingAnalytics | undefined;
  isDataStale: (trendDays: number, locationId?: string | null) => boolean;
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

        getData: (trendDays: number, locationId?: string | null) => {
          return get().dataByDays[cacheKey(trendDays, locationId)]?.analytics;
        },

        isDataStale: (trendDays: number, locationId?: string | null) => {
          const cached = get().dataByDays[cacheKey(trendDays, locationId)];
          if (!cached) return true;
          return Date.now() - cached.lastFetched >= STALE_TIME;
        },

        fetchAnalytics: async (trendDays: number, locationId?: string | null, force: boolean = false) => {
          const state = get();
          const key = cacheKey(trendDays, locationId);
          const cached = state.dataByDays[key];

          if (cached && !force && Date.now() - cached.lastFetched < STALE_TIME) {
            return;
          }

          if (state.isRefreshing && !force) return;

          set({ isRefreshing: true, error: null });

          try {
            const analytics = await serviceAnalyticsApi.getBookingAnalytics(trendDays, locationId ?? undefined);

            set((state) => ({
              dataByDays: {
                ...state.dataByDays,
                [key]: {
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
