import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  CompanySize,
  MonthlyRevenue,
  ShopRole,
} from "../utilities/GlobalTypes";
import { listShops } from "@/services/ShopServices";

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

  setShopsData: (shopsData: { shops: shopData[]; count: number }) => void;

  fetchListShops: () => Promise<void>;
}

export const useShopStore = create<ShopState>()(
  devtools((set, get) => ({
    shopsData: null,

    setShopsData: (shopsData) => {
      set({ shopsData }, false, "setShopsData");
    },

    fetchListShops: async () => {
      try {
        const res = await listShops();
        get().setShopsData(res.data);
      } catch (error) {
        console.error("An error occured:", error);
      }
    },
  }))
);
