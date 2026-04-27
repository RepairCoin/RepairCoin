import { View, Text } from "react-native";

type PaymentDetailsProps = {
  isTokenPurchase: boolean;
  tokenAmount: number;
  displayAmount: string;
};

export default function PaymentDetails({
  isTokenPurchase,
  tokenAmount,
  displayAmount,
}: PaymentDetailsProps) {
  return (
    <View className="mt-6 bg-gray-800/50 rounded-xl p-4">
      <Text className="text-gray-400 text-sm">
        {isTokenPurchase ? "Purchase Details" : "Subscription Details"}
      </Text>
      <View className="flex-row justify-between mt-2">
        <Text className="text-white">
          {isTokenPurchase
            ? `${tokenAmount.toLocaleString()} RCN Tokens`
            : "Monthly Subscription"}
        </Text>
        <Text className="text-[#FFCC00] font-bold">
          ${displayAmount}
          {!isTokenPurchase && "/month"}
        </Text>
      </View>
    </View>
  );
}
