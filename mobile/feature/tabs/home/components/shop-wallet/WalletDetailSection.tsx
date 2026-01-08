import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShopData } from "@/interfaces/shop.interface";
import StatCard from "@/components/ui/StatCard";

function WalletDetailSection({ shopData }: { shopData: ShopData }) {
  return (
    <View>
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Ionicons name="pie-chart" size={20} color="#FFCC00" />
        <Text className="text-white text-lg font-semibold ml-2">Token Overview</Text>
      </View>

      {/* Stats Row */}
      <View className="flex-row">
        <StatCard
          value={shopData?.totalRcnPurchased ?? 0}
          label="Purchased"
        />
        <StatCard
          value={shopData?.totalTokensIssued ?? 0}
          label="Issued"
        />
        <StatCard
          value={shopData?.rcg_balance ?? 0}
          label="RCG"
        />
      </View>
    </View>
  );
}

export default React.memo(WalletDetailSection);
