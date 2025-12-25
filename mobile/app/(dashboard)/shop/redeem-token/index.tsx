import React, { useState } from "react";
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
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { ThemedView } from "@/components/ui/ThemedView";
import { QRScanner } from "@/components/shop/QRScanner";
import { useAuthStore } from "@/store/auth.store";
import { useRedemption } from "@/hooks/redemption/useRedemption";
import { useShopRewards } from "@/hooks/useShopRewards";

const TIER_STYLES = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600",
} as const;

export default function RedeemToken() {
  const shopData = useAuthStore((state) => state.userProfile);

  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [redemptionAmount, setRedemptionAmount] = useState("");

  const {
    customerAddress,
    setCustomerAddress,
    customerData,
    isLoadingCustomer,
    customerError,
    currentSession,
    sessionStatus,
    timeRemaining,
    createSession,
    cancelSession,
    resetRedemption,
    isCreatingSession,
    isCancellingSession,
  } = useRedemption({
    onError: (error: any) => {
      // Extract error message from axios error response
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to process redemption. Please try again.";

      Alert.alert("Redemption Error", errorMessage);
    },
  });

  const {} = useShopRewards();

  const handleProcessRedemption = () => {
    if (!customerAddress) {
      Alert.alert("Error", "Please enter a valid customer address");
      return;
    }

    // Prevent shop from processing redemptions for themselves
    if (
      shopData?.address &&
      customerAddress.toLowerCase() === shopData.address.toLowerCase()
    ) {
      Alert.alert(
        "Error",
        "You cannot process redemption for your own wallet address"
      );
      return;
    }

    if (!customerData) {
      Alert.alert(
        "Error",
        "Customer not found. Customer must be registered before processing redemption."
      );
      return;
    }

    const amount = parseFloat(redemptionAmount);
    if (!redemptionAmount || isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid redemption amount");
      return;
    }

    // Check if customer has sufficient balance
    if (amount > customerData.balance) {
      Alert.alert(
        "Error",
        `Insufficient balance. Customer has ${customerData.balance} RCN, but ${amount} RCN requested.`
      );
      return;
    }

    if (!shopData?.id) {
      Alert.alert("Error", "Shop ID not found");
      return;
    }

    // Create redemption session
    createSession({
      customerAddress,
      shopId: shopData.id,
      amount,
    });
  };

  const handleCancelSession = () => {
    if (!currentSession) return;

    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this redemption request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: () => cancelSession(currentSession.sessionId),
        },
      ]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleCompleteAnother = () => {
    resetRedemption();
    setRedemptionAmount("");
  };

  const isCustomerSelf =
    shopData?.address &&
    customerAddress &&
    customerAddress.toLowerCase() === shopData.address.toLowerCase();

  const hasInsufficientBalance =
    customerData &&
    redemptionAmount &&
    parseFloat(redemptionAmount) > customerData.balance;

  const canProcessRedemption =
    !isCreatingSession &&
    customerAddress &&
    customerData &&
    redemptionAmount &&
    parseFloat(redemptionAmount) > 0 &&
    !hasInsufficientBalance &&
    !isCustomerSelf;

  return (
    <ThemedView className="flex-1 bg-black">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={goBack} className="p-2 -ml-2">
            <AntDesign name="arrowleft" color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">
            Process Redemption
          </Text>
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
              <Pressable onPress={() => setShowQRScanner(true)} className="p-2">
                <MaterialIcons
                  name="qr-code-scanner"
                  size={24}
                  color="#FFCC00"
                />
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

            {/* Customer Info Display */}
            {customerData && (
              <View className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-700">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View
                      className={`px-3 py-1 rounded-full mr-3 ${
                        TIER_STYLES[customerData.tier]
                      }`}
                    >
                      <Text className="text-white text-xs font-bold">
                        {customerData.tier}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-gray-400 text-xs">
                        Current Balance
                      </Text>
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

        {/* Redemption Amount Selection */}
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
                onChangeText={setRedemptionAmount}
                placeholder="0"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-700 text-white rounded-xl text-xl font-bold"
              />
            </View>

            {/* Quick Amount Buttons */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              {[10, 25, 50, 100].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setRedemptionAmount(amount.toString())}
                  className="bg-[#0A0A0A] border border-gray-700 px-4 py-2 rounded-xl"
                >
                  <Text className="text-[#FFCC00] font-semibold">
                    {amount} RCN
                  </Text>
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
                  Customer has {customerData?.balance} RCN, but{" "}
                  {redemptionAmount} RCN requested.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Process Redemption Button - Hide when session is active */}
      {sessionStatus === "idle" && (
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
                    ${((parseFloat(redemptionAmount) || 0) * 0.1).toFixed(2)}
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
              onPress={handleProcessRedemption}
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
                    {!customerAddress
                      ? "Enter Customer Address"
                      : !customerData
                        ? "Customer Not Found"
                        : !redemptionAmount || parseFloat(redemptionAmount) <= 0
                          ? "Enter Redemption Amount"
                          : `Process ${redemptionAmount} RCN Redemption`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

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
              How Redemption Works
            </Text>

            <View className="space-y-4">
              {[
                {
                  icon: "person-search",
                  title: "Find Customer",
                  desc: "Enter customer's wallet address to check their balance",
                },
                {
                  icon: "payments",
                  title: "Enter Amount",
                  desc: "Specify the RCN amount customer wants to redeem",
                },
                {
                  icon: "security",
                  title: "Customer Approves",
                  desc: "Customer receives notification and must approve the request",
                },
                {
                  icon: "check-circle",
                  title: "Complete Redemption",
                  desc: "RCN tokens are deducted and converted to store credit",
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

      {/* Processing Status Modal */}
      <Modal
        visible={sessionStatus !== "idle" && !!currentSession}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (sessionStatus === "completed") {
            handleCompleteAnother();
          }
        }}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#1A1A1A] rounded-t-3xl pt-6 pb-8 px-5 max-h-[80%]">
            {/* Modal Header */}
            <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

            <Text className="text-white text-xl font-bold mb-6 text-center">
              Processing Status
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status Indicator */}
              <View className="flex-row items-center justify-center mb-6">
                <View
                  className={`w-4 h-4 rounded-full mr-3 ${
                    sessionStatus === "waiting"
                      ? "bg-[#FFCC00]"
                      : sessionStatus === "processing"
                        ? "bg-blue-500"
                        : "bg-green-500"
                  }`}
                />
                <Text className="text-white font-semibold text-lg">
                  {sessionStatus === "waiting"
                    ? "Waiting for Customer Approval"
                    : sessionStatus === "processing"
                      ? "Processing Redemption"
                      : "Redemption Completed"}
                </Text>
              </View>

              {/* Customer Notification Info */}
              {sessionStatus === "waiting" && (
                <View className="bg-blue-500/10 rounded-xl p-4 mb-4 border border-blue-500/20">
                  <View className="flex-row items-start">
                    <MaterialIcons
                      name="notifications"
                      size={20}
                      color="#3B82F6"
                      style={{ marginRight: 8 }}
                    />
                    <View className="flex-1">
                      <Text className="text-blue-400 font-semibold text-sm mb-1">
                        Request Sent to Customer
                      </Text>
                      <Text className="text-blue-300/80 text-xs">
                        Customer has received a notification to approve this
                        redemption request. They have 5 minutes to respond.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Success Message */}
              {sessionStatus === "completed" && (
                <View className="bg-green-500/10 rounded-xl p-4 mb-4 border border-green-500/20">
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color="#10B981"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-green-400 font-semibold">
                      Redemption Successfully Processed!
                    </Text>
                  </View>
                </View>
              )}

              {/* Timer Display */}
              {(sessionStatus === "waiting" ||
                sessionStatus === "processing") && (
                <View className="bg-[#0A0A0A] rounded-xl p-4 mb-4 border border-gray-700">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <MaterialIcons
                        name="timer"
                        size={20}
                        color="#EF4444"
                        style={{ marginRight: 8 }}
                      />
                      <Text className="text-gray-400 text-sm">
                        {sessionStatus === "waiting"
                          ? "Time Remaining"
                          : "Processing Time"}
                      </Text>
                    </View>
                    <Text className="text-red-400 text-xl font-mono font-bold">
                      {timeRemaining}
                    </Text>
                  </View>
                </View>
              )}

              {/* Session Details */}
              {currentSession && (
                <View className="bg-[#0A0A0A] rounded-xl p-4 mb-6 border border-gray-700">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-gray-400 text-sm">Amount</Text>
                    <Text className="text-[#FFCC00] font-bold text-lg">
                      -{currentSession.amount} RCN
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-gray-400 text-sm">Customer</Text>
                    <Text className="text-white font-mono text-sm">
                      {currentSession.customerAddress.slice(0, 6)}...
                      {currentSession.customerAddress.slice(-4)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-400 text-sm">Session ID</Text>
                    <Text className="text-gray-400 text-xs font-mono">
                      {currentSession.sessionId.slice(-8)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Processing Animation */}
              {sessionStatus === "processing" && (
                <View className="flex-row items-center justify-center py-4 mb-4">
                  <ActivityIndicator
                    size="large"
                    color="#FFCC00"
                    style={{ marginRight: 12 }}
                  />
                  <Text className="text-[#FFCC00] font-semibold text-lg">
                    Customer Approved - Processing...
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View className="mt-4 space-y-3">
              {sessionStatus === "waiting" && (
                <View className="space-y-3 gap-4 mb-4">
                  <TouchableOpacity
                    onPress={handleCancelSession}
                    disabled={isCancellingSession}
                    className="bg-gray-700 py-4 rounded-xl"
                  >
                    {isCancellingSession ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text className="text-white font-semibold text-center text-lg">
                        Cancel Request
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {sessionStatus === "completed" && (
                <TouchableOpacity
                  onPress={handleCompleteAnother}
                  className="bg-[#FFCC00] py-4 rounded-xl"
                >
                  <Text className="text-black font-semibold text-center text-lg">
                    Process Another Redemption
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
