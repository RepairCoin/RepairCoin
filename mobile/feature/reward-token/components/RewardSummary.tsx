import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { CustomerData } from "../types";

interface RewardSummaryProps {
  baseReward: number;
  tierBonus: number;
  promoBonus: number;
  totalReward: number;
  customerInfo?: CustomerData;
  isIssuing: boolean;
  isDisabled: boolean;
  buttonText: string;
  onIssue: () => void;
  availableBalance: number;
  hasInsufficientBalance: boolean;
}

export default function RewardSummary({
  baseReward,
  tierBonus,
  promoBonus,
  totalReward,
  customerInfo,
  isIssuing,
  isDisabled,
  buttonText,
  onIssue,
  availableBalance,
  hasInsufficientBalance,
}: RewardSummaryProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800">
      <View className="px-5 py-4">
        {/* Available Balance Display */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-gray-400">Available Balance</Text>
          <Text className={`font-bold text-lg ${hasInsufficientBalance ? "text-red-500" : "text-[#FFCC00]"}`}>
            {availableBalance.toLocaleString()} RCN
          </Text>
        </View>

        {/* Insufficient Balance Warning */}
        {hasInsufficientBalance && totalReward > 0 && (
          <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 mb-3 flex-row items-center">
            <MaterialIcons name="error-outline" size={20} color="#EF4444" />
            <Text className="text-red-400 text-sm ml-2 flex-1">
              Insufficient balance. You need {(totalReward - availableBalance).toLocaleString()} more RCN.
            </Text>
          </View>
        )}

        <View className="bg-[#1A1A1A] rounded-xl p-4 mb-4">
          <Text className="text-white font-bold text-lg mb-3">
            Reward Summary
          </Text>
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-400">Base Reward</Text>
              <Text className="text-white font-semibold">{baseReward} RCN</Text>
            </View>
            {customerInfo && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">{customerInfo.tier} Bonus</Text>
                <Text className="text-green-500 font-semibold">
                  +{tierBonus} RCN
                </Text>
              </View>
            )}
            {promoBonus > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-gray-400">Promo Bonus</Text>
                <Text className="text-[#FFCC00] font-semibold">
                  +{promoBonus} RCN
                </Text>
              </View>
            )}
            <View className="border-t border-gray-600 pt-2 flex-row justify-between">
              <Text className="text-white font-bold">Total Reward</Text>
              <Text className="text-[#FFCC00] font-bold text-xl">
                {totalReward} RCN
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={onIssue}
          disabled={isDisabled}
          className={`py-4 rounded-xl flex-row items-center justify-center mb-4 ${
            isDisabled ? "bg-gray-800" : "bg-[#FFCC00]"
          }`}
        >
          {isIssuing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <MaterialIcons
                name="card-giftcard"
                size={20}
                color={isDisabled ? "#4B5563" : "#000"}
                style={{ marginRight: 8 }}
              />
              <Text
                className={`font-bold text-lg ${
                  isDisabled ? "text-gray-500" : "text-black"
                }`}
              >
                {buttonText}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
