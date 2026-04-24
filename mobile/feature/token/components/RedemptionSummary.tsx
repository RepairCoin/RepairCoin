import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { CustomerRedemptionData } from "../types";
import { calculateUsdValue } from "../utils";

interface RedemptionSummaryProps {
  redemptionAmount: string;
  customerAddress: string;
  customerData: CustomerRedemptionData | null;
  canProcessRedemption: boolean;
  isCreatingSession: boolean;
  onProcessRedemption: () => void;
}

export const RedemptionSummary: React.FC<RedemptionSummaryProps> = ({
  redemptionAmount,
  customerAddress,
  customerData,
  canProcessRedemption,
  isCreatingSession,
  onProcessRedemption,
}) => {
  const amount = parseFloat(redemptionAmount) || 0;

  const getButtonText = () => {
    if (!customerAddress) return "Enter Customer Address";
    if (!customerData) return "Customer Not Found";
    if (!redemptionAmount || amount <= 0) return "Enter Redemption Amount";
    return `Process ${redemptionAmount} RCN Redemption`;
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800">
      <View className="px-5 py-4">
        {/* Redemption Summary */}
        <View className="bg-[#1A1A1A] rounded-xl p-4 mb-4">
          <Text className="text-white font-bold text-lg mb-3">
            Redemption Summary
          </Text>
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-400">Amount</Text>
              <Text className="text-white font-semibold">
                {redemptionAmount || "0"} RCN
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-400">USD Value</Text>
              <Text className="text-white font-semibold">
                ${calculateUsdValue(amount)}
              </Text>
            </View>
            <View className="border-t border-gray-600 pt-2 flex-row justify-between">
              <Text className="text-white font-bold">Total Deduction</Text>
              <Text className="text-red-400 font-bold text-xl">
                -{redemptionAmount || "0"} RCN
              </Text>
            </View>
          </View>
        </View>

        {/* Process Redemption Button */}
        <TouchableOpacity
          onPress={onProcessRedemption}
          disabled={!canProcessRedemption}
          className={`py-4 rounded-xl flex-row items-center justify-center mb-4 ${
            canProcessRedemption ? "bg-red-500" : "bg-gray-800"
          }`}
        >
          {isCreatingSession ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialIcons
                name="payments"
                size={20}
                color={canProcessRedemption ? "#FFF" : "#4B5563"}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-bold text-lg ${
                  canProcessRedemption ? "text-white" : "text-gray-500"
                }`}
              >
                {getButtonText()}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
