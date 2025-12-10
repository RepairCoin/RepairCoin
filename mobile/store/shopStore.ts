import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  CompanySize,
  MonthlyRevenue,
  ShopRole,
} from "../utilities/GlobalTypes";
import { 
  createStripeCheckout,
} from "@/services/ShopServices";

export interface shopData {
  shopId: string;
  companyName: string;
  ownerName: string;
  address: string;
  reimbursementAddress: string;
  email: string;
  phone: string;
  website: string;
  role: ShopRole;
  companySize: CompanySize;
  monthlyRevenue: MonthlyRevenue;
  referralBy: string;
  streetAddress: string;
  city: string;
  country: string;
  isVerified: true;
  isActive: boolean;
  isCrossShopEnabled: boolean;
  rcnBalance: number;
  totalIssuedRewards: number;
  joinDate: Date;
}

interface ShopState {
  shopsData: {
    shops: shopData[];
    count: number;
  } | null;
  purchaseAmount: number;
  purchasing: boolean;

  setShopsData: (shopsData: { shops: shopData[]; count: number }) => void;
  setPurchaseAmount: (amount: number) => void;
  setPurchasing: (purchasing: boolean) => void;

  initiatePurchase: () => Promise<{ checkoutUrl: string; sessionId: string; purchaseId: string } | null>;
}

export const useShopStore = create<ShopState>()(
  devtools((set, get) => ({
    shopsData: null,
    purchaseAmount: 5,
    purchasing: false,

    setShopsData: (shopsData) => {
      set({ shopsData }, false, "setShopsData");
    },

    setPurchaseAmount: (amount) => {
      set({ purchaseAmount: amount }, false, "setPurchaseAmount");
    },

    setPurchasing: (purchasing) => {
      set({ purchasing }, false, "setPurchasing");
    },

    initiatePurchase: async () => {
      const { purchaseAmount } = get();
      if (purchaseAmount < 5) {
        console.error("Minimum purchase amount is 5 RCN");
        return null;
      }

      set({ purchasing: true }, false, "initiatePurchase:start");
      try {
        const response = await createStripeCheckout(purchaseAmount);
        if (response.success && response.data) {
          // Don't fetch history immediately since the purchase is pending
          // It will be fetched when user returns from Stripe
          return response.data;
        }
        return null;
      } catch (error) {
        console.error("Failed to create Stripe checkout:", error);
        return null;
      } finally {
        set({ purchasing: false }, false, "initiatePurchase:end");
      }
    },
  }))
);
