import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useHomeDataUI } from "@/feature/shop/account/hooks";
import { ShopTabs } from "@/feature/shop/services/shop.interface";
import {
  ShopWalletTab,
  PromoCodeTab,
  AnalyticsTab,
} from "../../components";

/*
 * Wallet / Analysis / Promo Code — the legacy home-screen tabs, moved off the
 * dashboard to their own screen (route: /shop/tools).
 */
export default function ShopToolsScreen() {
  const { shopData, growthData, refetch } = useHomeDataUI();
  const [activeTab, setActiveTab] = useState<ShopTabs>("Wallet");
  const shopTabs: ShopTabs[] = ["Wallet", "Analysis", "Promo Code"];

  return (
    <ThemedView className="h-full w-full">
      <AppHeader title="Wallet & Tools" />

      <View className="flex-1 px-4">
        <View className="flex-row w-full h-10 bg-[#121212] rounded-lg mt-2">
          {shopTabs.map((tab, i) => {
            const isActive = activeTab === tab;
            const isFirst = i === 0;
            const isLast = i === shopTabs.length - 1;

            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 items-center justify-center ${
                  isActive ? "bg-[#FFCC00]" : "bg-[#121212]"
                } ${isFirst ? "rounded-l-lg" : ""} ${isLast ? "rounded-r-lg" : ""}`}
              >
                <Text
                  className={`text-base font-bold ${
                    isActive ? "text-black" : "text-gray-400"
                  }`}
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "Wallet" && shopData && (
          <ShopWalletTab
            shopData={shopData}
            growthData={growthData}
            onRefresh={refetch}
          />
        )}
        {activeTab === "Promo Code" && shopData && <PromoCodeTab />}
        {activeTab === "Analysis" && shopData && <AnalyticsTab />}
      </View>
    </ThemedView>
  );
}
