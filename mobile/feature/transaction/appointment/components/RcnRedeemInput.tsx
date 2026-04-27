import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { RcnRedeemInputProps } from "../types";

export default function RcnRedeemInput({
  rcnToRedeem,
  maxRcnRedeemable,
  maxRcnLimit,
  onRcnChange,
  onMaxRcn,
}: RcnRedeemInputProps) {
  return (
    <View>
      <Text className="text-white text-lg font-semibold mb-1">
        Apply RCN Discount
      </Text>
      <Text className="text-gray-400 text-sm mb-4">
        Use your RCN tokens to get a discount on this service
      </Text>

      <View className="mb-4">
        <View className="flex-row items-center bg-zinc-900 rounded-xl border border-zinc-800 px-4">
          <TextInput
            className="flex-1 text-white text-lg py-4"
            placeholder="0.00"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            value={rcnToRedeem}
            onChangeText={onRcnChange}
          />
          <Text className="text-gray-400 mr-3">RCN</Text>
          <TouchableOpacity
            onPress={onMaxRcn}
            className="bg-[#FFCC00]/20 px-3 py-1 rounded-lg"
          >
            <Text className="text-[#FFCC00] font-semibold">MAX</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-gray-500 text-xs mt-2">
          Max redeemable: {maxRcnRedeemable.toFixed(2)} RCN (limit: {maxRcnLimit} RCN)
        </Text>
      </View>
    </View>
  );
}
