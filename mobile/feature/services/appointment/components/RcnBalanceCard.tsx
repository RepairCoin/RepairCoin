import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RcnBalanceCardProps } from "../types";

export default function RcnBalanceCard({ availableRcn }: RcnBalanceCardProps) {
  return (
    <View className="p-4 bg-zinc-900 rounded-xl border border-zinc-800">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white text-lg font-semibold">
          Your RCN Balance
        </Text>
        <View className="flex-row items-center">
          <Ionicons name="wallet-outline" size={18} color="#FFCC00" />
          <Text className="text-[#FFCC00] text-lg font-bold ml-2">
            {availableRcn.toFixed(2)} RCN
          </Text>
        </View>
      </View>
      <Text className="text-gray-400 text-sm">
        1 RCN = $0.10 USD discount
      </Text>
    </View>
  );
}
