import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { QUICK_AMOUNTS } from "../constants";
import { CustomerRedemptionData } from "../types";

interface RedemptionAmountSectionProps {
  redemptionAmount: string;
  onAmountChange: (amount: string) => void;
  customerData: CustomerRedemptionData | null;
  hasInsufficientBalance: boolean;
}

export const RedemptionAmountSection: React.FC<RedemptionAmountSectionProps> = ({
  redemptionAmount,
  onAmountChange,
  customerData,
  hasInsufficientBalance,
}) => {
  return (
    <View className="px-5 mb-40">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <Text className="text-white text-lg font-bold mb-4">
          Redemption Amount
        </Text>

        {/* Amount Input */}
        <View className="mb-4">
          <Text className="text-gray-400 text-sm font-medium mb-2">
            Enter RCN Amount to Redeem
          </Text>
          <TextInput
            value={redemptionAmount}
            onChangeText={onAmountChange}
            placeholder="0"
            placeholderTextColor="#6B7280"
            keyboardType="numeric"
            className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl text-xl font-bold"
          />
        </View>

        {/* Quick Amount Buttons */}
        <View className="flex-row flex-wrap gap-2 mb-4">
          {QUICK_AMOUNTS.map((amount) => (
            <TouchableOpacity
              key={amount}
              onPress={() => onAmountChange(amount.toString())}
              className="bg-[#0A0A0A] border border-gray-700 px-4 py-2 rounded-xl"
            >
              <Text className="text-[#FFCC00] font-semibold">{amount} RCN</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Insufficient Balance Warning */}
        {hasInsufficientBalance && (
          <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 mb-4">
            <View className="flex-row items-center">
              <MaterialIcons name="error" size={20} color="#EF4444" />
              <Text className="text-red-400 font-semibold ml-2">
                Insufficient Balance
              </Text>
            </View>
            <Text className="text-red-300/70 text-xs mt-1">
              Customer has {customerData?.balance} RCN, but {redemptionAmount}{" "}
              RCN requested.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
