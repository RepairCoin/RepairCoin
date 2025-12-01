import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import {
  AntDesign,
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { ThemedView } from "@/components/ui/ThemedView";
import { useShopRewards, RepairType } from "@/hooks/useShopRewards";
import { useAuthStore } from "@/store/auth.store";
import { QRScanner } from "@/components/shop/QRScanner";

// Tier styles
const TIER_STYLES = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600",
} as const;

export default function RewardToken() {
  const shopData = useAuthStore((state) => state.userProfile);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const {
    // Customer management
    customerAddress,
    setCustomerAddress,
    customerInfo,
    isLoadingCustomer,
    customerError,

    // Repair calculations
    repairType,
    setRepairType,
    customAmount,
    setCustomAmount,
    customRcn,
    setCustomRcn,
    baseReward,
    tierBonus,
    totalReward,
    getRepairAmount,

    // Promo codes
    availablePromoCodes,
    promoCode,
    setPromoCode,
    promoBonus,
    promoError,
    showPromoDropdown,
    setShowPromoDropdown,
    isValidatingPromo,

    // Issue reward
    issueReward,
    isIssuingReward,
  } = useShopRewards();

  const handleIssueReward = () => {
    if (!customerAddress) {
      Alert.alert("Error", "Please enter a valid customer address");
      return;
    }

    // Prevent shop from issuing rewards to themselves
    if (
      shopData?.address &&
      customerAddress.toLowerCase() === shopData.address.toLowerCase()
    ) {
      Alert.alert("Error", "You cannot issue rewards to your own wallet address");
      return;
    }

    if (!customerInfo) {
      Alert.alert(
        "Error",
        "Customer not found. Customer must be registered before receiving rewards."
      );
      return;
    }

    if (repairType === "custom") {
      const amount = parseFloat(customAmount);
      if (!customAmount || isNaN(amount) || amount <= 0) {
        Alert.alert("Error", "Please enter a valid repair amount");
        return;
      }
      if (!customRcn || parseFloat(customRcn) <= 0) {
        Alert.alert("Error", "Please enter a valid RCN reward amount");
        return;
      }
    }

    // Create request object
    const request = {
      customerAddress,
      repairAmount: getRepairAmount(),
      skipTierBonus: false,
      promoCode: promoCode.trim() || undefined,
      ...(repairType === "custom" && {
        customBaseReward: parseFloat(customRcn),
      }),
    };

    issueReward(request);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Refresh would be handled by React Query automatically
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const repairOptions = [
    {
      type: "minor" as RepairType,
      label: "XS Repair",
      rcn: 5,
      description: "$30 - $50 repair value",
    },
    {
      type: "small" as RepairType,
      label: "Small Repair",
      rcn: 10,
      description: "$50 - $99 repair value",
    },
    {
      type: "large" as RepairType,
      label: "Large Repair",
      rcn: 15,
      description: "$100+ repair value",
    },
  ];

  return (
    <ThemedView className="flex-1 bg-black">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={goBack} className="p-2 -ml-2">
            <AntDesign name="arrowleft" color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Issue Rewards</Text>
          <TouchableOpacity
            onPress={() => setShowHowItWorks(true)}
            className="p-2 -mr-2"
          >
            <Feather name="info" color="#FFCC00" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
          />
        }
      >
        {/* Customer Details Section */}
        <View className="px-5 mb-6">
          <View className="bg-[#1A1A1A] rounded-2xl p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-lg font-bold">
                Customer Details
              </Text>
              <Pressable 
                onPress={() => setShowQRScanner(true)}
                className="p-2"
              >
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
                  onChangeText={setCustomerAddress}
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

            {/* Promo Code Input */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-400 text-sm font-medium">
                  Promo Code (Optional)
                </Text>
                {promoBonus > 0 && (
                  <View className="flex-row items-center bg-[#FFCC00]/20 px-2 py-1 rounded-full">
                    <MaterialIcons name="check-circle" size={12} color="#FFCC00" />
                    <Text className="text-[#FFCC00] text-xs ml-1 font-semibold">
                      +{promoBonus} RCN
                    </Text>
                  </View>
                )}
                {isValidatingPromo && (
                  <View className="flex-row items-center bg-gray-500/20 px-2 py-1 rounded-full">
                    <ActivityIndicator size={12} color="#6B7280" />
                    <Text className="text-gray-400 text-xs ml-1">Checking...</Text>
                  </View>
                )}
              </View>
              <View className="relative">
                <TextInput
                  value={promoCode}
                  onChangeText={(text) => {
                    const newValue = text.toUpperCase();
                    setPromoCode(newValue);
                    setShowPromoDropdown(true);
                  }}
                  onFocus={() => setShowPromoDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPromoDropdown(false), 200)}
                  placeholder="Enter or select promo code"
                  placeholderTextColor="#6B7280"
                  className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl"
                />
                {promoCode && (
                  <TouchableOpacity
                    onPress={() => setPromoCode("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <MaterialIcons name="clear" size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}

                {/* Promo Code Dropdown */}
                {showPromoDropdown && availablePromoCodes.length > 0 && (
                  <View className="absolute z-10 w-full mt-2 bg-[#2A2A2A] border border-gray-600 rounded-xl shadow-xl max-h-64">
                    <ScrollView>
                      {availablePromoCodes
                        .filter((code) =>
                          code.code.toUpperCase().includes(promoCode.toUpperCase())
                        )
                        .map((code) => (
                          <TouchableOpacity
                            key={code.id}
                            onPress={() => {
                              setPromoCode(code.code);
                              setShowPromoDropdown(false);
                            }}
                            className="px-4 py-3 border-b border-gray-700 last:border-b-0"
                          >
                            <View className="flex-row items-center justify-between">
                              <View>
                                <Text className="text-white font-semibold">
                                  {code.code}
                                </Text>
                                {code.name && (
                                  <Text className="text-gray-400 text-sm">
                                    {code.name}
                                  </Text>
                                )}
                              </View>
                              <Text className="text-[#FFCC00] font-bold">
                                {code.bonus_type === "fixed"
                                  ? `+${code.bonus_value} RCN`
                                  : `${code.bonus_value}%`}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {promoError && (
                <View className="mt-2 flex-row items-center">
                  <MaterialIcons name="error" size={16} color="#EF4444" />
                  <Text className="text-red-400 text-sm ml-1">{promoError}</Text>
                </View>
              )}
            </View>

            {/* Customer Info Display */}
            {customerInfo && (
              <View className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-700">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className={`px-3 py-1 rounded-full mr-3 ${TIER_STYLES[customerInfo.tier]}`}>
                      <Text className="text-white text-xs font-bold">
                        {customerInfo.tier}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-gray-400 text-xs">Lifetime Earnings</Text>
                      <Text className="text-white font-semibold">
                        {customerInfo.lifetime_earnings} RCN
                      </Text>
                    </View>
                  </View>
                  <View className="bg-green-500/20 px-2 py-1 rounded-full">
                    <Text className="text-green-400 text-xs font-semibold">
                      ✓ No Limits
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Customer Not Found Warning */}
            {!isLoadingCustomer &&
              customerAddress &&
              customerAddress.length === 42 &&
              !customerInfo &&
              !(shopData?.address && customerAddress.toLowerCase() === shopData.address.toLowerCase()) && (
                <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                  <View className="flex-row items-center">
                    <MaterialIcons name="error" size={20} color="#EF4444" />
                    <Text className="text-red-400 font-semibold ml-2">
                      Customer Not Registered
                    </Text>
                  </View>
                  <Text className="text-red-300/70 text-xs mt-1">
                    This wallet address is not registered. Customer must register
                    before receiving rewards.
                  </Text>
                </View>
              )}

            {/* Self-Reward Warning */}
            {!isLoadingCustomer &&
              customerAddress &&
              customerAddress.length === 42 &&
              shopData?.address &&
              customerAddress.toLowerCase() === shopData.address.toLowerCase() && (
                <View className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
                  <View className="flex-row items-center">
                    <MaterialIcons name="warning" size={20} color="#F59E0B" />
                    <Text className="text-yellow-400 font-semibold ml-2">
                      Cannot Issue to Your Own Wallet
                    </Text>
                  </View>
                  <Text className="text-yellow-300/70 text-xs mt-1">
                    You cannot issue rewards to your own wallet address.
                  </Text>
                </View>
              )}
          </View>
        </View>

        {/* Repair Type Selection */}
        <View className="px-5 mb-40">
          <View className="bg-[#1A1A1A] rounded-2xl p-5">
            <Text className="text-white text-lg font-bold mb-4">
              Select Repair Type
            </Text>

            {/* Custom Amount Option */}
            <TouchableOpacity
              onPress={() => setRepairType("custom")}
              className={`p-4 rounded-xl border-2 mb-4 ${
                repairType === "custom"
                  ? "border-[#FFCC00] bg-[#FFCC00]/10"
                  : "border-gray-700 bg-[#0A0A0A]"
              }`}
            >
              <View className="flex-row items-center">
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 ${
                    repairType === "custom"
                      ? "border-[#FFCC00] bg-[#FFCC00]"
                      : "border-gray-500"
                  }`}
                >
                  {repairType === "custom" && (
                    <MaterialIcons name="check" size={20} color="black" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold">Custom Amount</Text>
                  <Text className="text-gray-400 text-sm">
                    Enter specific RCN reward and repair value
                  </Text>
                </View>
              </View>

              {repairType === "custom" && (
                <View className="mt-4 flex-col gap-2">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-sm mb-2">
                      Repair Amount ($)
                    </Text>
                    <TextInput
                      value={customAmount}
                      onChangeText={setCustomAmount}
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                      className="w-full px-4 py-3 bg-[#000] border border-gray-600 text-white rounded-xl"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-sm mb-2">RCN Reward</Text>
                    <TextInput
                      value={customRcn}
                      onChangeText={setCustomRcn}
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                      className="w-full px-4 py-3 bg-[#000] border border-gray-600 text-white rounded-xl"
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-gray-600" />
              <Text className="text-gray-400 text-sm px-4">OR</Text>
              <View className="flex-1 h-px bg-gray-600" />
            </View>

            {/* Preset Repair Options */}
            <View className="space-y-3 gap-2">
              {repairOptions.map((option) => (
                <TouchableOpacity
                  key={option.type}
                  onPress={() => {
                    setRepairType(option.type);
                    setCustomAmount("");
                    setCustomRcn("");
                  }}
                  className={`p-4 rounded-xl border-2 ${
                    repairType === option.type
                      ? "border-[#FFCC00] bg-[#FFCC00]/10"
                      : "border-gray-700 bg-[#0A0A0A]"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View
                        className={`w-5 h-5 rounded-full border-2 mr-3 ${
                          repairType === option.type
                            ? "border-[#FFCC00] bg-[#FFCC00]"
                            : "border-gray-500"
                        }`}
                      >
                        {repairType === option.type && (
                          <MaterialIcons name="check" size={20} color="black" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-semibold">
                          {option.label}
                        </Text>
                        <Text className="text-gray-400 text-sm">
                          {option.description}
                        </Text>
                      </View>
                    </View>
                    <View className="text-right">
                      <Text className="text-[#FFCC00] text-2xl font-bold">
                        {option.rcn}
                      </Text>
                      <Text className="text-[#FFCC00] text-xs">RCN</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Reward Summary and Issue Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800">
        <View className="px-5 py-4">
          {/* Reward Breakdown */}
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

          {/* Issue Reward Button */}
          <TouchableOpacity
            onPress={handleIssueReward}
            disabled={
              isIssuingReward ||
              !customerAddress ||
              !customerInfo ||
              totalReward <= 0 ||
              (repairType === "custom" &&
                (!customAmount || !customRcn || parseFloat(customAmount) <= 0))
            }
            className={`py-4 rounded-xl flex-row items-center justify-center mb-4 ${
              isIssuingReward ||
              !customerAddress ||
              !customerInfo ||
              totalReward <= 0 ||
              (repairType === "custom" &&
                (!customAmount || !customRcn || parseFloat(customAmount) <= 0))
                ? "bg-gray-800"
                : "bg-[#FFCC00]"
            }`}
          >
            {isIssuingReward ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <MaterialIcons
                  name="card-giftcard"
                  size={20}
                  color={
                    !customerAddress || !customerInfo || totalReward <= 0
                      ? "#4B5563"
                      : "#000"
                  }
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={`font-bold text-lg ${
                    !customerAddress || !customerInfo || totalReward <= 0
                      ? "text-gray-500"
                      : "text-black"
                  }`}
                >
                  {!customerAddress
                    ? "Enter Customer Address"
                    : !customerInfo
                    ? "Customer Not Found"
                    : totalReward <= 0
                    ? "Select Repair Type"
                    : `Issue ${totalReward} RCN`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* How It Works Modal */}
      <Modal
        visible={showHowItWorks}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <View className="flex-1 bg-black/80">
          <Pressable
            className="flex-1"
            onPress={() => setShowHowItWorks(false)}
          />
          <View className="bg-[#1A1A1A] rounded-t-3xl pt-6 pb-8 px-5">
            <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

            <Text className="text-white text-xl font-bold mb-6">
              How Reward System Works
            </Text>

            <View className="space-y-4">
              {[
                {
                  icon: "person-search",
                  title: "Find Customer",
                  desc: "Enter customer's wallet address to check their tier",
                },
                {
                  icon: "build",
                  title: "Select Repair",
                  desc: "Choose repair type or enter custom amount and RCN",
                },
                {
                  icon: "star",
                  title: "Tier Bonuses",
                  desc: "Silver +2 RCN, Gold +5 RCN automatically added",
                },
                {
                  icon: "local-offer",
                  title: "Apply Promo",
                  desc: "Optional promo codes for additional bonuses",
                },
                {
                  icon: "send",
                  title: "Instant Transfer",
                  desc: "RCN tokens transferred directly to customer's wallet",
                },
              ].map((item, index) => (
                <View key={index} className="flex-row items-start">
                  <View className="w-10 h-10 bg-[#FFCC00]/20 rounded-xl items-center justify-center mr-4">
                    <MaterialIcons
                      name={item.icon as any}
                      size={20}
                      color="#FFCC00"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold mb-1">
                      {item.title}
                    </Text>
                    <Text className="text-gray-400 text-sm">{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => setShowHowItWorks(false)}
              className="bg-[#FFCC00] rounded-xl py-4 mt-6"
            >
              <Text className="text-black text-center font-bold">Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={(address) => {
          setCustomerAddress(address);
          setShowQRScanner(false);
        }}
      />
    </ThemedView>
  );
}