import { View, Text } from "react-native";
import { SUBSCRIPTION_PRICE, SUBSCRIPTION_PERIOD } from "../constants";

type PriceCardProps = {
  isSubscribed: boolean;
};

export default function PriceCard({ isSubscribed }: PriceCardProps) {
  return (
    <View className="bg-[#2B2B2B] rounded-xl p-4 mb-6">
      <View className="items-center">
        <Text
          className={`text-5xl font-extrabold ${
            isSubscribed ? "text-[#4CAF50]" : "text-[#FFCC00]"
          }`}
        >
          ${SUBSCRIPTION_PRICE}
        </Text>
        <Text className="text-white/50 text-base mt-1">per {SUBSCRIPTION_PERIOD}</Text>
      </View>
    </View>
  );
}
