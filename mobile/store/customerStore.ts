import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Tier } from "@/utilities/GlobalTypes";
import { calculateTierByAddress, getEarningHistoryByWalletAddress, getRCNBalanceByWalletAddress } from "@/services/CustomerServices";

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
  RCNBalance: RCNBalanceData | null;
  earningHistory: RCNEarningHistory | null;
  tier: CustomerTierStatus | null;

  setRCNBalance: (RCNBalance: RCNBalanceData | null) => void;
  setEarningHistory: (earningHistory: RCNEarningHistory | null) => void;
  setTier: (tier: CustomerTierStatus | null) => void;

  fetchRCNBalance: (address: string) => Promise<void>;
  fetchEarningHistory: (address: string) => Promise<void>;
  fetchTier: (address: string, repairAmount: number) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>()(
  devtools((set, get) => ({
    RCNBalance: null,
    earningHistory: null,
    tier: null,

    setRCNBalance: (RCNBalance) => {
      set({ RCNBalance }, false, "setRCNBalance");
    },
    setEarningHistory: (earningHistory) => {
      set({ earningHistory }, false, "setEarningHistory");
    },
    setTier: (tier) => {
      set({ tier }, false, "setTier");
    },

    fetchRCNBalance: async (address) => {
      try {
        const res = await getRCNBalanceByWalletAddress(address);
        get().setRCNBalance(res.data);
      } catch (error) {
        console.error("An error occured:", error);
      }
    },
    fetchEarningHistory: async (address) => {
      try {
        const res = await getEarningHistoryByWalletAddress(address);
        get().setEarningHistory(res.data);
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
