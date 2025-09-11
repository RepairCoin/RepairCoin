import { create } from "zustand";
import { devtools } from "zustand/middleware";

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

export interface EarnedBalanceData {
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
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
  earnedBalanceData: EarnedBalanceData | null;
  transactions: TransactionHistory[];
  blockchainBalance: number;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Cache management
  lastFetchTime: number | null;
  
  // Actions
  setCustomerData: (data: CustomerData | null) => void;
  setEarnedBalanceData: (data: EarnedBalanceData | null) => void;
  setTransactions: (transactions: TransactionHistory[]) => void;
  setBlockchainBalance: (balance: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Fetch action
  fetchCustomerData: (address: string, force?: boolean) => Promise<void>;
  
  // Clear cache
  clearCache: () => void;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useCustomerStore = create<CustomerStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      customerData: null,
      earnedBalanceData: null,
      transactions: [],
      blockchainBalance: 0,
      isLoading: false,
      error: null,
      lastFetchTime: null,

      // Setters
      setCustomerData: (data) => set({ customerData: data }),
      setEarnedBalanceData: (data) => set({ earnedBalanceData: data }),
      setTransactions: (transactions) => set({ transactions }),
      setBlockchainBalance: (balance) => set({ blockchainBalance: balance }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Clear cache
      clearCache: () => set({
        customerData: null,
        earnedBalanceData: null,
        transactions: [],
        blockchainBalance: 0,
        lastFetchTime: null,
        error: null,
      }),

      // Fetch customer data
      fetchCustomerData: async (address: string, force: boolean = false) => {
        const state = get();
        
        // Check if data is still fresh and not forced refresh
        if (!force && state.lastFetchTime && Date.now() - state.lastFetchTime < CACHE_DURATION) {
          return; // Use cached data
        }

        // Prevent duplicate fetches
        if (state.isLoading) return;

        set({ isLoading: true, error: null });

        try {
          // Fetch customer data
          const customerResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/${address}`
          );
          
          if (customerResponse.ok) {
            const customerResult = await customerResponse.json();
            const customerData = customerResult.data.customer || customerResult.data;
            set({ customerData });
            
            // Store blockchain balance separately
            if (customerResult.data.blockchainBalance !== undefined) {
              set({ blockchainBalance: customerResult.data.blockchainBalance });
            }
          } else if (customerResponse.status === 404) {
            set({ error: 'Address not associated with a customer account.' });
            return;
          }

          // Authenticate customer to get JWT token if not already present
          const existingToken = localStorage.getItem("customerAuthToken");
          if (!existingToken) {
            try {
              const authResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/customer`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ address }),
                }
              );

              if (authResponse.ok) {
                const authResult = await authResponse.json();
                localStorage.setItem("customerAuthToken", authResult.token);
                sessionStorage.setItem("customerAuthToken", authResult.token);
              }
            } catch (authError) {
              console.log("Customer authentication error:", authError);
            }
          }

          // Fetch earned balance data
          const balanceResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${address}`
          );
          if (balanceResponse.ok) {
            const balanceResult = await balanceResponse.json();
            set({ earnedBalanceData: balanceResult.data });
          }

          // Fetch recent transactions
          const customerToken = localStorage.getItem("customerAuthToken");
          const transactionsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/${address}/transactions?limit=10`,
            {
              headers: {
                ...(customerToken
                  ? { Authorization: `Bearer ${customerToken}` }
                  : {}),
              },
            }
          );
          if (transactionsResponse.ok) {
            const transactionsResult = await transactionsResponse.json();
            set({ transactions: transactionsResult.data?.transactions || [] });
          }

          set({ lastFetchTime: Date.now() });
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