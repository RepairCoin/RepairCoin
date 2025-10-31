import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Tier } from "@/utilities/GlobalTypes";
import { 
  calculateTierByAddress, 
  getCustomerByWalletAddress, 
  getRCNBalanceByWalletAddress 
} from "@/services/CustomerServices";

export interface RCNBalanceData {
  earnedBalance: number;
  totalBalance: number;
  marketBalance: number;
  earningHistory: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
}

export interface RCNEarningHistory {
  earningSources: {
    shopId: string;
    shopName: string;
    totalEarned: number;
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    lastEarning: Date;
  }[];
  summary: {
    totalShops: number;
    primaryShop: string;
    totalEarned: number;
  };
}

export interface CustomerTierStatus {
  customerTier: Tier;
  baseRcnEarned: number;
  bonusAmount: number;
  totalRcnAwarded: number;
  bonusPercentage: number;
}

interface CustomerState {
  customerData: any;
  RCNBalance: RCNBalanceData | null;
  earningHistory: RCNEarningHistory | null;
  tier: CustomerTierStatus | null;

  setCustomerData: (customerData: any) => void;
  setRCNBalance: (RCNBalance: RCNBalanceData | null) => void;
  setEarningHistory: (earningHistory: RCNEarningHistory | null) => void;
  setTier: (tier: CustomerTierStatus | null) => void;

  fetchCustomerData: (address: string) => Promise<void>;
  fetchRCNBalance: (address: string) => Promise<void>;
  fetchTier: (address: string, repairAmount: number) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>()(
  devtools((set, get) => ({
    customerData: null,
    RCNBalance: null,
    earningHistory: null,
    tier: null,

    setCustomerData: (customerData) => {
      set({ customerData }, false, "customerData");
    },
    setRCNBalance: (RCNBalance) => {
      set({ RCNBalance }, false, "setRCNBalance");
    },
    setEarningHistory: (earningHistory) => {
      set({ earningHistory }, false, "setEarningHistory");
    },
    setTier: (tier) => {
      set({ tier }, false, "setTier");
    },

    fetchCustomerData: async (address) => {
      try {
        const res = await getCustomerByWalletAddress(address);
        get().setCustomerData(res.data);
      } catch (error) {
        console.error("An error occured:", error);
      }
    },
    fetchRCNBalance: async (address) => {
      try {
        const res = await getRCNBalanceByWalletAddress(address);
        get().setRCNBalance(res.data);
      } catch (error) {
        console.error("An error occured:", error);
      }
    },
    fetchTier: async (address, repairAmount) => {
      try {
        const res = await calculateTierByAddress(address, repairAmount);
        get().setTier(res.data);
      } catch (error) {
        console.error("An error occured:", error);
      }
    }
  }))
);
