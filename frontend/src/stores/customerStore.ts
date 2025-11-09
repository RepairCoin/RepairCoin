import { create } from "zustand";
import { devtools } from "zustand/middleware";
import apiClient from "@/services/api/client";

export interface CustomerData {
  address: string;
  email: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  referralCount?: number;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  currentBalance: number;
  totalRedemptions: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  isActive: boolean;
  suspensionReason?: string;
  lastEarnedDate?: string;
  joinDate: string;
  notificationsEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

export interface BalanceData {
  availableBalance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
  earningHistory?: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
  homeShop?: string;
}

export interface TransactionHistory {
  id: string;
  type: "earned" | "redeemed" | "bonus" | "referral" | "tier_bonus";
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

export interface CustomerStore {
  // Data
  customerData: CustomerData | null;
  balanceData: BalanceData | null;
  transactions: TransactionHistory[];
  blockchainBalance: number;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCustomerData: (data: CustomerData | null) => void;
  setBalanceData: (data: BalanceData | null) => void;
  setTransactions: (transactions: TransactionHistory[]) => void;
  setBlockchainBalance: (balance: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Fetch action
  fetchCustomerData: (address: string, force?: boolean) => Promise<void>;
  
  // Clear cache
  clearCache: () => void;
}

export const useCustomerStore = create<CustomerStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      customerData: null,
      balanceData: null,
      transactions: [],
      blockchainBalance: 0,
      isLoading: false,
      error: null,

      // Setters
      setCustomerData: (data) => set({ customerData: data }),
      setBalanceData: (data) => {
        if (data) {
          // Round all numeric values to 2 decimal places
          const roundedData = {
            ...data,
            availableBalance: Math.round(data.availableBalance * 100) / 100,
            lifetimeEarned: Math.round(data.lifetimeEarned * 100) / 100,
            totalRedeemed: Math.round(data.totalRedeemed * 100) / 100,
          };
          set({ balanceData: roundedData });
        } else {
          set({ balanceData: data });
        }
      },
      setTransactions: (transactions) => {
        // Round transaction amounts to 2 decimal places
        const roundedTransactions = transactions.map(tx => ({
          ...tx,
          amount: Math.round(tx.amount * 100) / 100
        }));
        set({ transactions: roundedTransactions });
      },
      setBlockchainBalance: (balance) => set({ blockchainBalance: Math.round(balance * 100) / 100 }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Clear cache
      clearCache: () => set({
        customerData: null,
        balanceData: null,
        transactions: [],
        blockchainBalance: 0,
        error: null,
      }),

      // Fetch customer data
      fetchCustomerData: async (address: string, force: boolean = false) => {
        const state = get();
        
        // Prevent duplicate fetches
        if (!force && state.isLoading) return;

        set({ isLoading: true, error: null });

        try {
          // Fetch customer data (cookies sent automatically)
          const customerResponse = await apiClient.get(`/customers/${address}`);

          if (customerResponse.success && customerResponse.data) {
            const customerData = customerResponse.data.customer || customerResponse.data;
            set({ customerData });

            // Store blockchain balance separately (rounded to 2 decimal places)
            if (customerResponse.data.blockchainBalance !== undefined) {
              set({ blockchainBalance: Math.round(customerResponse.data.blockchainBalance * 100) / 100 });
            }
          } else if (customerResponse.code === 'NOT_FOUND') {
            set({ error: 'Address not associated with a customer account.' });
            return;
          }

          // Fetch balance data (cookies sent automatically)
          const balanceResponse = await apiClient.get(`/tokens/balance/${address}`);
          if (balanceResponse.success && balanceResponse.data) {
            const data = balanceResponse.data;
            // Round all numeric values to 2 decimal places
            if (data) {
              const roundedData = {
                ...data,
                availableBalance: Math.round(data.availableBalance * 100) / 100,
                lifetimeEarned: Math.round(data.lifetimeEarned * 100) / 100,
                totalRedeemed: Math.round(data.totalRedeemed * 100) / 100,
              };
              get().setBalanceData(roundedData);
            } else {
              get().setBalanceData(data);
            }
          }

          // Fetch recent transactions (cookies sent automatically)
          const transactionsResponse = await apiClient.get(
            `/customers/${address}/transactions?limit=10`
          );
          if (transactionsResponse.success) {
            set({ transactions: transactionsResponse.data?.transactions || [] });
          }
        } catch (err) {
          console.log("Error fetching customer data:", err);
          set({ error: "Failed to load customer data" });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "customer-store",
    }
  )
);