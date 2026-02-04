import { View, Text } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";

type SubscriptionStatusBadgeProps = {
  isSubscribed: boolean;
  isPendingCancellation?: boolean;
};

export default function SubscriptionStatusBadge({
  isSubscribed,
  isPendingCancellation,
}: SubscriptionStatusBadgeProps) {
  if (!isSubscribed) return null;

  if (isPendingCancellation) {
    return (
      <View className="bg-orange-500/20 rounded-xl p-3 mb-4 flex-row items-center justify-center gap-2">
        <Ionicons name="time-outline" color="#f97316" size={18} />
        <Text className="text-orange-500 font-semibold">Pending Cancellation</Text>
      </View>
    );
  }

  return (
    <View className="bg-[#2B4D2B] rounded-xl p-3 mb-4 flex-row items-center justify-center gap-2">
      <AntDesign name="checkcircle" color="#4CAF50" size={18} />
      <Text className="text-[#4CAF50] font-semibold">Active Subscription</Text>
    </View>
  );
}
