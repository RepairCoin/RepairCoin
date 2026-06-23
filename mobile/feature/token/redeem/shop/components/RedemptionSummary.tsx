import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { calculateUsdValue } from "@/shared/utilities/calculateUsdValue";
import { CustomerRedemptionData } from "../../../../shop/services/shop.interface";

interface RedemptionSummaryProps {
  redemptionAmount: string;
  customerAddress: string;
  customerData: CustomerRedemptionData | null;
  canProcessRedemption: boolean;
  isCreatingSession: boolean;
  isLoadingCustomer?: boolean;
  onProcessRedemption: () => void;
}

const shortenAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const getTierBadgeClass = (tier?: string) => {
  switch (tier?.toUpperCase()) {
    case "GOLD":
      return "bg-[#F7B500]";
    case "SILVER":
      return "bg-[#9CA3AF]";
    default:
      return "bg-[#CD7F32]";
  }
};

const getTierTextClass = (tier?: string) =>
  tier?.toUpperCase() === "BRONZE" || !tier ? "text-white" : "text-black";

export const RedemptionSummary: React.FC<RedemptionSummaryProps> = ({
  redemptionAmount,
  customerAddress,
  customerData,
  canProcessRedemption,
  isCreatingSession,
  isLoadingCustomer = false,
  onProcessRedemption,
}) => {
  const amount = parseFloat(redemptionAmount) || 0;

  return (
    <View className="px-5 pb-6">
      <View className="bg-[#101010] rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-800">
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 bg-[#FFCC00] rounded-lg items-center justify-center">
              <MaterialIcons name="card-giftcard" size={18} color="#000" />
            </View>
            <Text className="text-lg font-semibold text-[#FFCC00]">
              Redemption Summary
            </Text>
          </View>
        </View>

        {/* Redemption Details */}
        <View className="px-5 py-5">
          {/* Customer Info Section - Card Style */}
          <View className="bg-[#1a1a1a] rounded-xl overflow-hidden mb-5">
            {/* Customer */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800/50">
              <Text className="text-white text-sm font-medium">Customer •</Text>
              <Text className="text-[#FFCC00] font-semibold">
                {customerAddress ? shortenAddress(customerAddress) : "—"}
              </Text>
            </View>

            {/* Base Reward / Tier */}
            <View className="flex-row items-center justify-between px-4 py-3 bg-[#222222] border-b border-gray-800/50">
              <Text className="text-white text-sm font-medium">
                Base Reward •
              </Text>
              {customerData ? (
                <View
                  className={`px-4 py-1 rounded-full ${getTierBadgeClass(
                    customerData.tier
                  )}`}
                >
                  <Text
                    className={`text-xs font-bold ${getTierTextClass(
                      customerData.tier
                    )}`}
                  >
                    {customerData.tier.toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Text className="text-gray-500">—</Text>
              )}
            </View>

            {/* Balance */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800/50">
              <Text className="text-white text-sm font-medium">Balance •</Text>
              <Text className="text-[#22C55E] font-semibold">
                {isLoadingCustomer
                  ? "Loading..."
                  : customerData
                  ? `${Math.floor(customerData.balance)} RCN`
                  : "0 RCN"}
              </Text>
            </View>

            {/* Relationship */}
            <View className="flex-row items-center justify-between px-4 py-3">
              <Text className="text-white text-sm font-medium">
                Relationship •
              </Text>
              {customerData ? (
                customerData.isHomeShop ? (
                  <View className="items-end">
                    <Text className="text-green-400 font-semibold text-sm">
                      🏠 Home Shop
                    </Text>
                    <Text className="text-green-500/70 text-xs">
                      100% redeemable
                    </Text>
                  </View>
                ) : (
                  <View className="items-end">
                    <Text className="text-amber-400 font-semibold text-sm">
                      🔄 Cross-Shop
                    </Text>
                    <Text className="text-amber-500/70 text-xs">
                      Max {Math.floor(customerData.crossShopLimit)} RCN (20%)
                    </Text>
                  </View>
                )
              ) : isLoadingCustomer ? (
                <Text className="text-gray-500 text-sm">Checking...</Text>
              ) : (
                <Text className="text-gray-500 text-sm">—</Text>
              )}
            </View>
          </View>

          {/* Redemption Amount Display */}
          <View className="mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white font-semibold">
                Redemption Amount:
              </Text>
              <Text className="text-[#22C55E] font-bold text-xl">
                {amount || 0} RCN
              </Text>
            </View>
            <Text className="text-center text-white text-sm">
              USD Value:{" "}
              <Text className="font-bold">${calculateUsdValue(amount)}</Text>
            </Text>
          </View>

          {/* Process Button */}
          <TouchableOpacity
            onPress={onProcessRedemption}
            disabled={!canProcessRedemption}
            className={`py-4 rounded-xl flex-row items-center justify-center ${
              canProcessRedemption ? "bg-[#FFCC00]" : "bg-gray-800"
            }`}
          >
            {isCreatingSession ? (
              <ActivityIndicator color={canProcessRedemption ? "#000" : "#FFF"} />
            ) : (
              <>
                <MaterialIcons
                  name="security"
                  size={20}
                  color={canProcessRedemption ? "#000" : "#4B5563"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={`font-bold text-lg ${
                    canProcessRedemption ? "text-black" : "text-gray-500"
                  }`}
                >
                  Request Customer Approval
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Exchange Rate */}
          <Text className="text-center text-xs text-gray-500 mt-3">
            Exchange Rate: 1 RCN = $0.10
          </Text>
        </View>
      </View>
    </View>
  );
};
