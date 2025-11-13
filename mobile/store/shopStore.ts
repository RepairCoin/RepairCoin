import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  CompanySize,
  MonthlyRevenue,
  ShopRole,
} from "../utilities/GlobalTypes";
import { 
  listShops, 
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

  fetchListShops: () => Promise<void>;
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

    fetchListShops: async () => {
      try {
        const res = await listShops();
        // Map ShopData to shopData format
        const mappedShops: shopData[] = res.data.shops.map((shop: any) => ({
          shopId: shop.shopId,
          companyName: shop.name || shop.companyName,
          ownerName: `${shop.firstName || ''} ${shop.lastName || ''}`.trim() || shop.ownerName || '',
          address: shop.address,
          reimbursementAddress: shop.address, // Using same as address for now
          email: shop.email,
          phone: shop.phone,
          website: shop.website || '',
          role: 'SHOP' as ShopRole,
          companySize: shop.companySize as CompanySize,
          monthlyRevenue: shop.monthlyRevenue as MonthlyRevenue,
          referralBy: shop.referral || '',
          streetAddress: shop.location?.state || '',
          city: shop.location?.city || '',
          country: shop.country || '',
          isVerified: shop.verified || false,
          isActive: shop.active || false,
          isCrossShopEnabled: shop.crossShopEnabled || false,
          rcnBalance: 0, // This would need to come from another endpoint
          totalIssuedRewards: 0, // This would need to come from another endpoint
          joinDate: new Date(shop.joinDate),
        }));
        
        get().setShopsData({
          shops: mappedShops,
          count: res.data.count
        });
      } catch (error) {
        console.error("An error occured:", error);
      }
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
