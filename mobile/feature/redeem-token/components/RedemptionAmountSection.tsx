import React, { useCallback, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { QUICK_AMOUNTS } from "../constants";
import { CustomerRedemptionData } from "../types";

interface RedemptionAmountSectionProps {
  redemptionAmount: string;
  onAmountChange: (amount: string) => void;
  customerData: CustomerRedemptionData | null;
  hasInsufficientBalance: boolean;
  exceedsCrossShopLimit?: boolean;
}

export const RedemptionAmountSection: React.FC<RedemptionAmountSectionProps> = ({
  redemptionAmount,
  onAmountChange,
  customerData,
  hasInsufficientBalance,
  exceedsCrossShopLimit = false,
}) => {
  // Calculate max points based on home shop vs cross-shop
  const maxRedeemablePoints = useMemo(() => {
    if (!customerData) return 0;
    return customerData.maxRedeemable;
  }, [customerData]);

  // Filter quick amounts to only show valid options
  const validQuickAmounts = useMemo(() => {
    if (!customerData) return QUICK_AMOUNTS;
    return QUICK_AMOUNTS.filter((amount) => amount <= maxRedeemablePoints);
  }, [customerData, maxRedeemablePoints]);

  /**
   * Handles amount change with validation
   * Prevents entering amounts above the maximum redeemable limit
   */
  const handleAmountChange = useCallback(
    (value: string) => {
      // Allow empty input
      if (!value) {
        onAmountChange("");
        return;
      }

      // Remove non-numeric characters except decimal point
      const numericValue = value.replace(/[^0-9.]/g, "");
      const amount = parseFloat(numericValue);

      // Allow the input but validation happens in parent
      onAmountChange(numericValue);
    },
    [onAmountChange]
  );

  /**
   * Sets the maximum allowed amount based on redemption limits
   */
  const handleSetMaxAmount = useCallback(() => {
    if (customerData) {
      onAmountChange(maxRedeemablePoints.toString());
    }
  }, [customerData, maxRedeemablePoints, onAmountChange]);

  return (
    <View className="px-5 mb-40">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <Text className="text-white text-lg font-bold mb-4">
          Redemption Amount
        </Text>

        {/* Redemption Limit Info */}
        {customerData && (
          <View
            className={`rounded-xl p-3 mb-4 ${
              customerData.isHomeShop
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-amber-500/10 border border-amber-500/30"
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons
                name={customerData.isHomeShop ? "home" : "store"}
                size={18}
                color={customerData.isHomeShop ? "#22C55E" : "#F59E0B"}
              />
              <Text
                className={`ml-2 font-semibold text-sm ${
                  customerData.isHomeShop ? "text-green-400" : "text-amber-400"
                }`}
              >
                {customerData.isHomeShop ? "Home Shop" : "Cross-Shop Redemption"}
              </Text>
            </View>
            <Text
              className={`text-xs mt-1 ${
                customerData.isHomeShop ? "text-green-300/70" : "text-amber-300/70"
              }`}
            >
              {customerData.isHomeShop
                ? `100% redemption allowed (${customerData.balance.toFixed(2)} RCN available)`
                : `Max ${maxRedeemablePoints.toFixed(2)} RCN (20% cross-shop limit)`}
            </Text>
          </View>
        )}

        {/* Amount Input */}
        <View className="mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-400 text-sm font-medium">
              Enter RCN Amount to Redeem
            </Text>
            {customerData && (
              <TouchableOpacity onPress={handleSetMaxAmount}>
                <Text className="text-[#FFCC00] text-sm font-semibold">
                  MAX
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            value={redemptionAmount}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor="#6B7280"
            keyboardType="numeric"
            className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl text-xl font-bold"
          />
        </View>

        {/* Quick Amount Buttons */}
        <View className="flex-row flex-wrap gap-2 mb-4">
          {QUICK_AMOUNTS.map((amount) => {
            const isDisabled = customerData
              ? amount > maxRedeemablePoints
              : false;
            return (
              <TouchableOpacity
                key={amount}
                onPress={() => !isDisabled && onAmountChange(amount.toString())}
                disabled={isDisabled}
                className={`px-4 py-2 rounded-xl ${
                  isDisabled
                    ? "bg-gray-800 border border-gray-600 opacity-50"
                    : "bg-[#0A0A0A] border border-gray-700"
                }`}
              >
                <Text
                  className={`font-semibold ${
                    isDisabled ? "text-gray-500" : "text-[#FFCC00]"
                  }`}
                >
                  {amount} RCN
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cross-Shop Limit Warning */}
        {exceedsCrossShopLimit && !hasInsufficientBalance && (
          <View className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30 mb-4">
            <View className="flex-row items-center">
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text className="text-amber-400 font-semibold ml-2">
                Cross-Shop Limit Exceeded
              </Text>
            </View>
            <Text className="text-amber-300/70 text-xs mt-1">
              This customer can only redeem up to{" "}
              {customerData?.maxRedeemable.toFixed(2)} RCN at your shop (20%
              cross-shop limit). They can redeem 100% at shops where they earned
              their RCN.
            </Text>
          </View>
        )}

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
