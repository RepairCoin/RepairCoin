import React, { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useShop } from "@/hooks/shop/useShop";
import { useAuthStore } from "@/store/auth.store";
import { ThemedView } from "@/components/ui/ThemedView";
import WalletTab from "./tabs/WalletTab";
import PromoCodeTab from "./tabs/PromoCodeTab";
import AnalyticsTab from "./tabs/AnalyticsTab";

type ShopTabs = "Wallet" | "Analysis" | "Promo Code";

export default function Home() {
  const { useGetShopByWalletAddress } = useShop();
  const { account } = useAuthStore();
  const { data: shopData, refetch } = useGetShopByWalletAddress(
    account?.address || ""
  );

  const [activeTab, setActiveTab] = useState<ShopTabs>("Wallet");
  const shopTabs: ShopTabs[] = ["Wallet", "Analysis", "Promo Code"];

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  return (
    <ThemedView className="h-full w-full">
      <View className="h-full w-full pt-14 px-4">
        <View className="flex-row items-center justify-between">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-[45%] h-10"
            resizeMode="contain"
          />
          <Pressable
            onPress={() => router.push("/shop/notification")}
            className="w-10 h-10 bg-[#121212] rounded-full items-center justify-center"
          >
            <Feather name="bell" size={20} color="white" />
          </Pressable>
        </View>
        <View className="flex-row my-4 justify-between items-center">
          <View className="flex-row">
            <Text className="text-lg font-semibold text-[#FFCC00] mr-2">
              Hello!
            </Text>
            <Text className="text-lg font-semibold text-white">
              {shopData?.name}
            </Text>
          </View>
        </View>
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl justify-between">
          {shopTabs.map((tab, i) => (
            <React.Fragment key={i}>
              <Pressable
                onPress={() => {
                  activeTab !== tab && setActiveTab(tab);
                }}
                className={`bg-${activeTab === tab ? "[#FFCC00]" : "[#121212]"} w-[33%] flex-row ${i === 0 && "rounded-l-xl"} ${i === 2 && "rounded-r-xl"} items-center justify-center`}
              >
                <Text
                  className={`text-base font-bold text-${activeTab === tab ? "black" : "gray-400"}`}
                >
                  {tab}
                </Text>
              </Pressable>
              {i !== 2 && activeTab === shopTabs[2 - 2 * i] && (
                <View className="w-[0.1%] bg-gray-400 my-2" />
              )}
            </React.Fragment>
          ))}
        </View>
        {activeTab === "Wallet" && shopData && (
          <WalletTab shopData={shopData} />
        )}
        {activeTab === "Promo Code" && shopData && <PromoCodeTab />}
        {activeTab === "Analysis" && shopData && <AnalyticsTab />}
      </View>
    </ThemedView>
  );
}
