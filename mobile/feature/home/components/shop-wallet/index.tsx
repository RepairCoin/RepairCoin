import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  ImageBackground,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons, Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/shared/store/auth.store";
import ActionCard from "@/shared/components/shared/ActionCard";
import { CustomerGrowthData, ShopData } from "@/shared/interfaces/shop.interface";
import WalletDetailSection from "./WalletDetailSection";
import CustomerDetailSection from "./CustomerDetailSection";

const subscriptionHomeImage = require("@/assets/images/subsciption_home.png");
const logoImage = require("@/assets/images/logo.png");

type ShopWalletTabProps = {
  shopData: ShopData;
  growthData?: CustomerGrowthData;
  onRefresh?: () => void;
};

export default function ShopWalletTab({
  shopData,
  growthData,
  onRefresh,
}: ShopWalletTabProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    if (!onRefresh) return;
    setRefreshing(true);
    onRefresh();
    // Give a brief delay for visual feedback
    setTimeout(() => setRefreshing(false), 1000);
  }, [onRefresh]);
  const router = useRouter();
  const { account } = useAuthStore();

  // Early return for missing data
  if (!account) {
    return (
      <View className="flex-1 justify-center items-center mt-20">
        <Text className="text-white text-lg">No wallet connected</Text>
      </View>
    );
  }

  return (
    <View className="mt-4 flex-1">
      <ScrollView
        className="flex-1 mt-5"
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#FFCC00"]}
            tintColor="#FFCC00"
            progressBackgroundColor="#1A1A1C"
          />
        }
        contentContainerStyle={{
          paddingBottom: 20,
          gap: 16,
        }}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* Balance Card with Quick Actions */}
        <ActionCard
          balance={shopData?.purchasedRcnBalance}
          isLoading={false}
          quickActions={[
            {
              icon: (
                <MaterialIcons
                  name="add-shopping-cart"
                  size={24}
                  color="#000"
                />
              ),
              label: "Buy",
              onPress: () => router.push("/shop/buy-token"),
            },
            {
              icon: (
                <MaterialIcons name="card-giftcard" size={24} color="#000" />
              ),
              label: "Reward",
              onPress: () => router.push("/shop/reward-token"),
            },
            {
              icon: <Octicons name="history" size={24} color="#000" />,
              label: "Redeem",
              onPress: () => router.push("/shop/redeem-token"),
            },
          ]}
        />

        {/* Appointments Quick Link */}
        <TouchableOpacity
          onPress={() => router.push("/shop/appointments" as any)}
          activeOpacity={0.7}
          className="bg-[#1a1a1a] rounded-2xl p-4 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-[#FFCC00]/10 items-center justify-center mr-3">
              <Ionicons name="calendar" size={22} color="#FFCC00" />
            </View>
            <View>
              <Text className="text-white font-semibold text-base">Appointments</Text>
              <Text className="text-gray-500 text-xs">View calendar & manage bookings</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        {/* Subscription Card */}
        {shopData?.operational_status !== "subscription_qualified" &&
          shopData?.operational_status !== "rcg_qualified" && (
          <View className="rounded-3xl overflow-hidden">
            <ImageBackground
              source={subscriptionHomeImage}
              resizeMode="contain"
              className="w-full"
              imageStyle={{
                borderRadius: 24,
                right: Platform.OS === "ios" ? -110 : -80,
              }}
              style={{ minHeight: Platform.OS === "ios" ? 180 : 160, backgroundColor: '#1a1a1c' }}
            >
              <View className="p-6 flex-1 justify-between">
                {/* Logo + Title */}
                <View>
                  <View className="flex-row items-center mb-3 ml-[-12px]">
                    <Image
                      source={logoImage}
                      style={{ width: 180, height: 40 }}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Tagline */}
                  <Text className="text-[#FFCC00] text-sm">
                    The Repair Industry's Loyalty Coin
                  </Text>
                </View>

                {/* Subscribe Button */}
                <TouchableOpacity
                  onPress={() => router.push("/shop/subscription")}
                  className="bg-[#FFCC00] rounded-xl py-3 px-6 self-start mt-4"
                  activeOpacity={0.8}
                >
                  <Text className="text-black text-base font-bold">
                    Subscribe Now
                  </Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          </View>
        )}

        {/* Detail Cards */}
        <WalletDetailSection shopData={shopData} />
        <CustomerDetailSection growthData={growthData} />
      </ScrollView>
    </View>
  );
}
