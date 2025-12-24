import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { MaterialIcons, Octicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/auth.store";
import ActionCard from "@/components/shared/ActionCard";
import { CustomerGrowthData, ShopData } from "@/interfaces/shop.interface";
import WalletDetailSection from "./WalletDetailSection";
import CustomerDetailSection from "./CustomerDetailSection";

export default function WalletTab({
  shopData,
  growthData,
}: {
  shopData: ShopData;
  growthData?: CustomerGrowthData;
}) {
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
            refreshing={false}
            onRefresh={() => {}}
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

        {/* Detail Cards */}
        <WalletDetailSection shopData={shopData} />
        <CustomerDetailSection growthData={growthData} />
      </ScrollView>
    </View>
  );
}
