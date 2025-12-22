import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  CompanySize,
  MonthlyRevenue,
  ShopRole,
} from "../utilities/GlobalTypes";

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
  }))
);
