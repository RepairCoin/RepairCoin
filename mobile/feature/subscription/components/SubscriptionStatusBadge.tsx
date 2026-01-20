import { View, Text } from "react-native";
import { AntDesign } from "@expo/vector-icons";

type SubscriptionStatusBadgeProps = {
  isSubscribed: boolean;
};

export default function SubscriptionStatusBadge({ isSubscribed }: SubscriptionStatusBadgeProps) {
  if (!isSubscribed) return null;

  return (
    <View className="bg-[#2B4D2B] rounded-xl p-3 mb-4 flex-row items-center justify-center gap-2">
      <AntDesign name="checkcircle" color="#4CAF50" size={18} />
      <Text className="text-[#4CAF50] font-semibold">Active Subscription</Text>
    </View>
  );
}
