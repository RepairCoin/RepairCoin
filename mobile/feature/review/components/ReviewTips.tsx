import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { REVIEW_TIPS } from "../constants";

export default function ReviewTips() {
  return (
    <View className="bg-[#FFCC00]/10 rounded-xl p-4 mb-6">
      <View className="flex-row items-center mb-2">
        <Ionicons name="bulb-outline" size={20} color="#FFCC00" />
        <Text className="text-[#FFCC00] font-semibold ml-2">
          Tips for a helpful review
        </Text>
      </View>
      <Text className="text-gray-400 text-sm leading-5">
        {REVIEW_TIPS.map((tip, index) => `• ${tip}`).join("\n")}
      </Text>
    </View>
  );
}
