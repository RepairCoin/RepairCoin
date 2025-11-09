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
          // Fetch customer data
          const customerResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/customers/${address}`
          );
          
          if (customerResponse.ok) {
            const customerResult = await customerResponse.json();
            const customerData = customerResult.data.customer || customerResult.data;
            set({ customerData });
            
            // Store blockchain balance separately (rounded to 2 decimal places)
            if (customerResult.data.blockchainBalance !== undefined) {
              set({ blockchainBalance: Math.round(customerResult.data.blockchainBalance * 100) / 100 });
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

          // Fetch balance data
          const balanceResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/tokens/balance/${address}`
          );
          if (balanceResponse.ok) {
            const balanceResult = await balanceResponse.json();
            const data = balanceResult.data;
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