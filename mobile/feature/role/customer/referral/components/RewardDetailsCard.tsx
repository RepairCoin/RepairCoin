import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REFERRER_REWARD, REFEREE_REWARD } from "../constants";

export default function RewardDetailsCard() {
  return (
    <View className="px-5 mb-6">
      <View className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-5 border border-zinc-800">
        <View className="flex-row items-center mb-3">
          <Ionicons name="information-circle" size={24} color="#FFCC00" />
          <Text className="text-white font-semibold text-base ml-2">
            Reward Details
          </Text>
        </View>
        <View className="flex-row items-center justify-between bg-zinc-800/50 rounded-xl p-4 mb-2">
          <Text className="text-gray-300">You receive</Text>
          <Text className="text-[#FFCC00] font-bold text-lg">
            {REFERRER_REWARD} RCN
          </Text>
        </View>
        <View className="flex-row items-center justify-between bg-zinc-800/50 rounded-xl p-4">
          <Text className="text-gray-300">Your friend receives</Text>
          <Text className="text-[#FFCC00] font-bold text-lg">
            {REFEREE_REWARD} RCN
          </Text>
        </View>
        <Text className="text-gray-500 text-xs text-center mt-3">
          Rewards are credited after your friend completes their first repair
        </Text>
      </View>
    </View>
  );
}
