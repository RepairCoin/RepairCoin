import { create } from "zustand";

type ShopProfileTab = "services" | "about" | "gallery" | "reviews" | "analytics" | "appointments" | "customers";

interface ShopProfileState {
  activeTab: ShopProfileTab;
  setActiveTab: (tab: ShopProfileTab) => void;
}

export const useShopProfileStore = create<ShopProfileState>((set) => ({
  activeTab: "services",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
