import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Tier } from "@/utilities/GlobalTypes";

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
  }))
);
