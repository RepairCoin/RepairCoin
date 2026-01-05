import React, { useCallback, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { ThemedView } from "@/components/ui/ThemedView";
import { useHomeQuery } from "../hooks";
import { ShopTabs } from "../types";
import { WalletTab, PromoCodeTab, AnalyticsTab } from "../components";

export default function Home() {
  const { shopData, growthData, refetch } = useHomeQuery();

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
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl">
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
                } ${isFirst ? "rounded-l-xl" : ""} ${isLast ? "rounded-r-xl" : ""}`}
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
          <WalletTab shopData={shopData} growthData={growthData} />
        )}
        {activeTab === "Promo Code" && shopData && <PromoCodeTab />}
        {activeTab === "Analysis" && shopData && <AnalyticsTab />}
      </View>
    </ThemedView>
  );
}
