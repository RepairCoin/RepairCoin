import { View, Text } from "react-native";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";

interface StatsCardsProps {
  totalReferrals: number;
  totalEarned: number;
}

export default function StatsCards({ totalReferrals, totalEarned }: StatsCardsProps) {
  return (
    <View className="px-5 mb-6">
      <View className="flex-row gap-3">
        <View className="flex-1 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <View className="bg-[#FFCC00]/20 w-10 h-10 rounded-full items-center justify-center mb-3">
            <FontAwesome5 name="users" size={18} color="#FFCC00" />
          </View>
          <Text className="text-gray-400 text-sm">Total Referrals</Text>
          <Text className="text-white text-2xl font-bold">{totalReferrals}</Text>
        </View>
        <View className="flex-1 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
          <View className="bg-[#FFCC00]/20 w-10 h-10 rounded-full items-center justify-center mb-3">
            <MaterialCommunityIcons name="hand-coin" size={20} color="#FFCC00" />
          </View>
          <Text className="text-gray-400 text-sm">RCN Earned</Text>
          <Text className="text-[#FFCC00] text-2xl font-bold">{totalEarned}</Text>
        </View>
      </View>
    </View>
  );
}
