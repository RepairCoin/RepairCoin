import { View, Text } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

type TokenPurchaseDetailsProps = {
  purchaseId?: string;
};

export default function TokenPurchaseDetails({ purchaseId }: TokenPurchaseDetailsProps) {
  return (
    <>
      {/* Purchase ID */}
      {purchaseId && (
        <View className="bg-[#1A1A1A] rounded-2xl p-4 mb-4 w-full">
          <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2">
            Transaction ID
          </Text>
          <Text className="text-white text-sm font-mono">
            {purchaseId.length > 16
              ? `${purchaseId.slice(0, 8)}...${purchaseId.slice(-8)}`
              : purchaseId}
          </Text>
        </View>
      )}

      {/* Token Balance Card */}
      <View className="bg-[#FFCC00]/10 rounded-2xl p-6 mb-6 w-full border border-[#FFCC00]/30">
        <View className="flex-row items-center justify-center">
          <FontAwesome5 name="coins" size={24} color="#FFCC00" />
          <Text className="text-[#FFCC00] text-lg font-semibold ml-3">
            Tokens Ready to Use!
          </Text>
        </View>
        <Text className="text-gray-300 text-sm text-center mt-3">
          Start rewarding your customers immediately
        </Text>
      </View>
    </>
  );
}
