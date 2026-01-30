import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { TIER_STYLES } from "../constants";
import { CustomerRedemptionData } from "../types";

interface CustomerDetailsSectionProps {
  customerAddress: string;
  onAddressChange: (address: string) => void;
  customerData: CustomerRedemptionData | null;
  isLoadingCustomer: boolean;
  customerError: string | null;
  isCustomerSelf: boolean;
  onQRScanPress: () => void;
}

export const CustomerDetailsSection: React.FC<CustomerDetailsSectionProps> = ({
  customerAddress,
  onAddressChange,
  customerData,
  isLoadingCustomer,
  customerError,
  isCustomerSelf,
  onQRScanPress,
}) => {
  return (
    <View className="px-5 mb-6">
      <View className="bg-[#1A1A1A] rounded-2xl p-5">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-lg font-bold">Customer Details</Text>
          <Pressable onPress={onQRScanPress} className="p-2">
            <MaterialIcons name="qr-code-scanner" size={24} color="#FFCC00" />
          </Pressable>
        </View>

        {/* Wallet Address Input */}
        <View className="mb-4">
          <Text className="text-gray-400 text-sm font-medium mb-2">
            Wallet Address
          </Text>
          <View className="relative">
            <TextInput
              value={customerAddress}
              onChangeText={onAddressChange}
              placeholder="0x0000...0000"
              placeholderTextColor="#6B7280"
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl"
            />
            {isLoadingCustomer && (
              <View className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <ActivityIndicator size="small" color="#FFCC00" />
              </View>
            )}
          </View>
        </View>

        {/* Customer Info Display */}
        {customerData && (
          <View className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-700">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  className={`px-3 py-1 rounded-full mr-3 ${TIER_STYLES[customerData.tier]}`}
                >
                  <Text className="text-white text-xs font-bold">
                    {customerData.tier}
                  </Text>
                </View>
                <View>
                  <Text className="text-gray-400 text-xs">Current Balance</Text>
                  <Text className="text-white font-semibold">
                    {customerData.balance} RCN
                  </Text>
                </View>
              </View>
              <View className="bg-red-500/20 px-2 py-1 rounded-full">
                <Text className="text-red-400 text-xs font-semibold">
                  ⚡ Redemption
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Customer Not Found Warning */}
        {!isLoadingCustomer &&
          customerAddress &&
          customerAddress.length === 42 &&
          !customerData &&
          !isCustomerSelf && (
            <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
              <View className="flex-row items-center">
                <MaterialIcons name="error" size={20} color="#EF4444" />
                <Text className="text-red-400 font-semibold ml-2">
                  Customer Not Found
                </Text>
              </View>
              <Text className="text-red-300/70 text-xs mt-1">
                {customerError ||
                  "This wallet address is not registered or has no balance."}
              </Text>
            </View>
          )}

        {/* Self-Redemption Warning */}
        {!isLoadingCustomer && isCustomerSelf && (
          <View className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
            <View className="flex-row items-center">
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text className="text-yellow-400 font-semibold ml-2">
                Cannot Process Own Redemption
              </Text>
            </View>
            <Text className="text-yellow-300/70 text-xs mt-1">
              You cannot process redemption for your own wallet address.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};
