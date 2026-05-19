import { View, Text } from "react-native";

type SubscriptionDetailsProps = {
  nextBillingDate: string;
};

export default function SubscriptionDetails({ nextBillingDate }: SubscriptionDetailsProps) {
  return (
    <View className="w-full bg-[#1a1a1a] rounded-2xl p-6 mb-6 border border-gray-800">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-gray-400 text-sm">Plan</Text>
        <Text className="text-white font-semibold">Monthly Subscription</Text>
      </View>
      <View className="h-px bg-gray-800 mb-4" />
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-gray-400 text-sm">Amount Paid</Text>
        <Text className="text-[#FFCC00] font-bold text-lg">$500.00</Text>
      </View>
      <View className="h-px bg-gray-800 mb-4" />
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-gray-400 text-sm">Status</Text>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          <Text className="text-green-500 font-semibold">Active</Text>
        </View>
      </View>
      <View className="h-px bg-gray-800 mb-4" />
      <View className="flex-row items-center justify-between">
        <Text className="text-gray-400 text-sm">Next Billing</Text>
        <Text className="text-white font-semibold">{nextBillingDate}</Text>
      </View>
    </View>
  );
}
