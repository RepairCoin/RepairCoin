import React, { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useHomeDataUI } from "@/feature/profile/shop/hooks";
import { ShopTabs } from "@/feature/profile/shop/services/shop.interface";
import { PromoCodeTab } from "@/feature/profile/shop/components";
import { AnalyticsTab } from "@/feature/profile/shop/components";
import { NotificationBell } from "@/feature/notification/components";
import { MessageButton } from "../components";
import { ShopWalletTab } from "../components";

export default function Home() {
  const { shopData, growthData, refetch } = useHomeDataUI();

  const [activeTab, setActiveTab] = useState<ShopTabs>("Wallet");
  const shopTabs: ShopTabs[] = ["Wallet", "Analysis", "Promo Code"];

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
            className="w-[30%] h-10"
            resizeMode="contain"
          />
          <View style={{ marginRight: -10 }} className="flex-row items-center gap-2">
            <MessageButton userType="shop" />
            <NotificationBell userType="shop" />
          </View>
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
        <View className="flex-row w-full h-10 bg-[#121212] rounded-lg">
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
          <ShopWalletTab shopData={shopData} growthData={growthData} onRefresh={refetch} />
        )}
        {activeTab === "Promo Code" && shopData && <PromoCodeTab />}
        {activeTab === "Analysis" && shopData && <AnalyticsTab />}
      </View>
    </ThemedView>
  );
}
