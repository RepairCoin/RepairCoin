import React from "react";
import { View, Text } from "react-native";

interface BalanceCardProps {
  totalBalance: number;
  totalRedeemed: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  totalBalance,
  totalRedeemed,
}) => {
  return (
    <View className="mt-4 bg-zinc-900 rounded-2xl p-5">
      <Text className="text-gray-400 text-sm">Available to Redeem</Text>
      <Text className="text-[#FFCC00] text-4xl font-bold mt-1">
        {totalBalance} RCN
      </Text>
      <Text className="text-gray-500 text-sm mt-2">
        = ${(totalBalance * 0.1).toFixed(2)} USD value
      </Text>

      <View className="flex-row mt-4 pt-4 border-t border-zinc-800">
        <View className="flex-1">
          <Text className="text-gray-500 text-xs">Total Redeemed</Text>
          <Text className="text-white font-semibold">{totalRedeemed} RCN</Text>
        </View>
        <View className="flex-1">
          <Text className="text-gray-500 text-xs">Redemption Rate</Text>
          <Text className="text-white font-semibold">$0.10 per RCN</Text>
        </View>
      </View>
    </View>
  );
};
