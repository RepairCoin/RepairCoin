import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import apiClient from '@/services/api/client';

// 5-minute stale threshold
const STALE_TIME = 5 * 60 * 1000;

export interface ShopProfitData {
  transactions: any[];
  purchases: any[];
  lastFetched: number;
}

interface ShopProfitState {
  // Per-shop data (keyed by shopId) - using Record for JSON serialization
  dataByShop: Record<string, ShopProfitData>;

  // UI state (not persisted)
  isRefreshing: boolean;
  error: string | null;

  // Actions
  fetchProfitData: (shopId: string, force?: boolean) => Promise<void>;
  startPolling: (shopId: string) => void;
  stopPolling: () => void;
  clearShopData: (shopId: string) => void;
  clearAllData: () => void;
  getShopData: (shopId: string) => ShopProfitData | undefined;
  isDataStale: (shopId: string) => boolean;
}

// Polling interval ref stored outside store for cleanup
let pollingInterval: NodeJS.Timeout | null = null;
let currentPollingShopId: string | null = null;

export const useShopProfitStore = create<ShopProfitState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        dataByShop: {},
        isRefreshing: false,
        error: null,

        // Get shop data helper
        getShopData: (shopId: string) => {
          return get().dataByShop[shopId];
        },

        // Check if data is stale
        isDataStale: (shopId: string) => {
          const data = get().dataByShop[shopId];
          if (!data) return true;
          return Date.now() - data.lastFetched >= STALE_TIME;
        },

        // Fetch profit data with stale-while-revalidate pattern
        fetchProfitData: async (shopId: string, force: boolean = false) => {
          const state = get();
          const existing = state.dataByShop[shopId];
          const now = Date.now();

          // Return cached if fresh (not stale) and not forced
          if (existing && !force) {
            const age = now - existing.lastFetched;
            if (age < STALE_TIME) {
              return; // Data is fresh, no fetch needed
            }
          }

          // Prevent duplicate fetches when already refreshing
          if (state.isRefreshing && !force) return;

          // Mark as refreshing (not loading - allows stale data to show)
          set({ isRefreshing: true, error: null });

          try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(endDate.getFullYear() - 5);

            const [transactions, purchases] = await Promise.all([
              apiClient.get(`/shops/${shopId}/transactions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`).catch(() => ({ data: [] })),
              apiClient.get(`/shops/${shopId}/purchases?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`).catch(() => ({ data: { items: [] } }))
            ]);

            // Normalize transaction data
            const transactionsArray = Array.isArray(transactions.data) ? transactions.data :
              Array.isArray(transactions.data?.transactions) ? transactions.data.transactions :
              Array.isArray(transactions) ? transactions : [];

            // Normalize purchases data
            const purchasesArray = Array.isArray(purchases.data?.items) ? purchases.data.items :
              Array.isArray(purchases.data?.purchases) ? purchases.data.purchases :
              Array.isArray(purchases.data) ? purchases.data :
              Array.isArray(purchases) ? purchases : [];

            // Update dataByShop with new data
            set((state) => ({
              dataByShop: {
                ...state.dataByShop,
                [shopId]: {
                  transactions: transactionsArray,
                  purchases: purchasesArray,
                  lastFetched: Date.now(),
                },
              },
              error: null,
            }));
          } catch (err) {
            console.error('Error fetching profit data:', err);
            set({ error: 'Failed to load profit data' });
          } finally {
            set({ isRefreshing: false });
          }
        },

        // Start 5-minute polling for a shop
        startPolling: (shopId: string) => {
          // Clear existing interval
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }

          currentPollingShopId = shopId;

          // Poll every 5 minutes
          pollingInterval = setInterval(() => {
            // Only poll if we're still interested in this shop
            if (currentPollingShopId === shopId) {
              get().fetchProfitData(shopId, true);
            }
          }, STALE_TIME);
        },

        // Stop polling
        stopPolling: () => {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          currentPollingShopId = null;
        },

        // Clear data for a specific shop
        clearShopData: (shopId: string) => {
          set((state) => {
            const { [shopId]: _, ...rest } = state.dataByShop;
            return { dataByShop: rest };
          });
        },

        // Clear all cached data
        clearAllData: () => {
          set({ dataByShop: {}, error: null });
        },
      }),
      {
        name: 'shop-profit-store', // localStorage key
        partialize: (state) => ({
          // Only persist data, not UI state (isRefreshing, error)
          dataByShop: state.dataByShop,
        }),
      }
    ),
    { name: 'shop-profit-store' }
  )
);
