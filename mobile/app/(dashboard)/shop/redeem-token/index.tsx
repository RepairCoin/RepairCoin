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
import { useAuthStore } from "@/store/authStore";

// Customer interface
interface CustomerInfo {
  address: string;
  tier: "GOLD" | "SILVER" | "BRONZE";
  balance: number;
  lifetimeEarnings: number;
}

// Redemption session interface
interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  amount: number;
  status: "pending" | "approved" | "processing" | "completed" | "expired";
  expiresAt: string;
  createdAt: string;
}

// Tier styles
const TIER_STYLES = {
  GOLD: "bg-gradient-to-r from-yellow-500 to-yellow-600",
  SILVER: "bg-gradient-to-r from-gray-400 to-gray-500",
  BRONZE: "bg-gradient-to-r from-orange-500 to-orange-600",
} as const;

export default function RedeemToken() {
  const shopData = useAuthStore((state) => state.userProfile);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Customer management
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

  // Redemption amount
  const [redemptionAmount, setRedemptionAmount] = useState("");
  const [isProcessingRedemption, setIsProcessingRedemption] = useState(false);

  // Redemption session management
  const [currentSession, setCurrentSession] = useState<RedemptionSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "waiting" | "processing" | "completed">("idle");
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Customer lookup API integration
  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      lookupCustomer(customerAddress);
    } else {
      setCustomerInfo(null);
    }
  }, [customerAddress]);

  // Function to lookup customer information
  const lookupCustomer = async (address: string) => {
    setIsLoadingCustomer(true);
    try {
      const authToken = useAuthStore.getState().userProfile?.token;

      if (!authToken) {
        throw new Error("Authentication required");
      }

      // Check if customer exists and get balance
      const [customerResponse, balanceResponse] = await Promise.all([
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/customers/${address}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
        fetch(`${process.env.EXPO_PUBLIC_API_URL}/customers/balance/${address}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
      ]);

      if (customerResponse.ok && balanceResponse.ok) {
        const customerData = await customerResponse.json();
        const balanceData = await balanceResponse.json();

        setCustomerInfo({
          address,
          tier: customerData.data?.tier || "BRONZE",
          balance: balanceData.data?.totalBalance || 0,
          lifetimeEarnings: customerData.data?.lifetimeEarnings || 0,
        });
      } else {
        // Customer not found or no balance
        setCustomerInfo(null);
      }
    } catch (error) {
      console.error("Error looking up customer:", error);
      setCustomerInfo(null);
    } finally {
      setIsLoadingCustomer(false);
    }
  };

  // Timer countdown effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (currentSession && (sessionStatus === "waiting" || sessionStatus === "processing")) {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(currentSession.expiresAt).getTime();
        const diff = expiry - now;

        if (diff <= 0) {
          setTimeRemaining("00:00");
          setSessionStatus("completed");
          setIsProcessingRedemption(false);
          Alert.alert("Success", "Redemption completed! The full 5 minutes have passed.");
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [currentSession, sessionStatus]);

  // Function to create redemption session via API
  const createRedemptionSession = async (customerAddress: string, amount: number) => {
    try {
      const authToken = useAuthStore.getState().userProfile?.token;
      const shopId = useAuthStore.getState().userProfile?.id;

      if (!authToken || !shopId) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/tokens/redemption-session/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            customerAddress,
            shopId,
            amount,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create redemption session");
      }

      const result = await response.json();
      
      // Return the session data from API
      return {
        sessionId: result.data.sessionId,
        customerAddress,
        amount,
        status: "pending" as const,
        expiresAt: result.data.expiresAt,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error creating redemption session:", error);
      throw error;
    }
  };

  // Function to check session status
  const checkSessionStatus = async (sessionId: string) => {
    try {
      const authToken = useAuthStore.getState().userProfile?.token;

      if (!authToken) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/tokens/redemption-session/status/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Session not found or has been cancelled");
        }
        throw new Error("Failed to check session status");
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error("Error checking session status:", error);
      throw error;
    }
  };

  // Function to cancel redemption session
  const cancelRedemptionSession = async (sessionId: string) => {
    try {
      const authToken = useAuthStore.getState().userProfile?.token;

      if (!authToken) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/tokens/redemption-session/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            sessionId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel session");
      }

      return true;
    } catch (error) {
      console.error("Error cancelling session:", error);
      throw error;
    }
  };

  const handleProcessRedemption = async () => {
    if (!customerAddress) {
      Alert.alert("Error", "Please enter a valid customer address");
      return;
    }

    // Prevent shop from processing redemptions for themselves
    if (
      shopData?.address &&
      customerAddress.toLowerCase() === shopData.address.toLowerCase()
    ) {
      Alert.alert("Error", "You cannot process redemption for your own wallet address");
      return;
    }

    if (!customerInfo) {
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
    if (amount > customerInfo.balance) {
      Alert.alert(
        "Error",
        `Insufficient balance. Customer has ${customerInfo.balance} RCN, but ${amount} RCN requested.`
      );
      return;
    }

    setIsProcessingRedemption(true);

    try {
      // Create redemption session via API
      const session = await createRedemptionSession(customerAddress, amount);
      
      setCurrentSession(session);
      setSessionStatus("waiting");

      Alert.alert(
        "Request Sent", 
        `Redemption request for ${session.amount} RCN has been sent to customer\n\nCustomer Address: ${session.customerAddress.slice(0, 8)}...${session.customerAddress.slice(-6)}\n\nThey have 5 minutes to approve this request.`,
        [{ text: "OK" }]
      );

      // Start polling for session status
      startSessionPolling(session.sessionId);
      
    } catch (error) {
      setIsProcessingRedemption(false);
      Alert.alert(
        "Error", 
        error instanceof Error ? error.message : "Failed to create redemption session"
      );
    }
  };

  // Function to start polling session status
  const startSessionPolling = (sessionId: string) => {
    let pollCount = 0;
    const maxPolls = 150; // 5 minutes max (2 seconds * 150)

    const interval = setInterval(async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        Alert.alert("Error", "Request timeout - please try again");
        setSessionStatus("idle");
        setCurrentSession(null);
        setIsProcessingRedemption(false);
        clearInterval(interval);
        return;
      }

      try {
        const sessionData = await checkSessionStatus(sessionId);

        // Update session expiry time
        setCurrentSession((prev) =>
          prev ? { ...prev, expiresAt: sessionData.expiresAt } : null
        );

        if (sessionData.status === "approved") {
          setSessionStatus("processing");
          clearInterval(interval);
          await processRedemption(sessionId);
        } else if (sessionData.status === "rejected") {
          // Check if session was cancelled by shop or rejected by customer
          const metadata = sessionData.metadata;
          const cancelledByShop = metadata?.cancelledByShop;
          
          if (cancelledByShop) {
            Alert.alert("Cancelled", "Redemption request was cancelled");
          } else {
            Alert.alert("Rejected", "Customer rejected the redemption request");
          }
          setSessionStatus("idle");
          setCurrentSession(null);
          setIsProcessingRedemption(false);
          clearInterval(interval);
        } else if (
          sessionData.status === "expired" ||
          new Date(sessionData.expiresAt) < new Date()
        ) {
          Alert.alert("Expired", "Redemption request expired");
          setSessionStatus("idle");
          setCurrentSession(null);
          setIsProcessingRedemption(false);
          clearInterval(interval);
        } else if (sessionData.status === "used") {
          Alert.alert("Success", "This redemption session has already been processed");
          setSessionStatus("completed");
          setIsProcessingRedemption(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error checking session status:", err);
        if (pollCount > 5) { // Only show error after a few tries
          Alert.alert("Error", "Failed to check session status");
          setSessionStatus("idle");
          setCurrentSession(null);
          setIsProcessingRedemption(false);
          clearInterval(interval);
        }
      }
    }, 2000);

    // Store interval reference for cleanup
    return interval;
  };

  // Function to process redemption after approval
  const processRedemption = async (sessionId: string) => {
    try {
      const authToken = useAuthStore.getState().userProfile?.token;
      const shopId = useAuthStore.getState().userProfile?.id;

      if (!authToken || !shopId) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/shops/${shopId}/redeem`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            customerAddress: currentSession?.customerAddress,
            amount: currentSession?.amount,
            sessionId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Redemption failed");
      }

      Alert.alert(
        "Success",
        `Successfully redeemed ${currentSession?.amount} RCN for customer`
      );

      // Reset form
      setCustomerAddress("");
      setCustomerInfo(null);
      setRedemptionAmount("");
      setCurrentSession(null);
      setSessionStatus("completed");
      setIsProcessingRedemption(false);

    } catch (err) {
      console.error("Redemption error:", err);
      Alert.alert(
        "Error", 
        err instanceof Error ? err.message : "Redemption failed"
      );
      setSessionStatus("idle");
      setIsProcessingRedemption(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Refresh would be handled by React Query automatically
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <ThemedView className="flex-1 bg-black">
      {/* Header */}
      <View className="pt-14 pb-4 px-5">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={goBack} className="p-2 -ml-2">
            <AntDesign name="arrowleft" color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Process Redemption</Text>
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
            <Text className="text-white text-lg font-bold mb-4">
              Customer Details
            </Text>

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
                      <Text className="text-gray-400 text-xs">Current Balance</Text>
                      <Text className="text-white font-semibold">
                        {customerInfo.balance} RCN
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
              !customerInfo &&
              !(shopData?.address && customerAddress.toLowerCase() === shopData.address.toLowerCase()) && (
                <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                  <View className="flex-row items-center">
                    <MaterialIcons name="error" size={20} color="#EF4444" />
                    <Text className="text-red-400 font-semibold ml-2">
                      Customer Not Found
                    </Text>
                  </View>
                  <Text className="text-red-300/70 text-xs mt-1">
                    This wallet address is not registered or has no balance.
                  </Text>
                </View>
              )}

            {/* Self-Redemption Warning */}
            {!isLoadingCustomer &&
              customerAddress &&
              customerAddress.length === 42 &&
              shopData?.address &&
              customerAddress.toLowerCase() === shopData.address.toLowerCase() && (
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
            {customerInfo && redemptionAmount && 
              parseFloat(redemptionAmount) > customerInfo.balance && (
                <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 mb-4">
                  <View className="flex-row items-center">
                    <MaterialIcons name="error" size={20} color="#EF4444" />
                    <Text className="text-red-400 font-semibold ml-2">
                      Insufficient Balance
                    </Text>
                  </View>
                  <Text className="text-red-300/70 text-xs mt-1">
                    Customer has {customerInfo.balance} RCN, but {redemptionAmount} RCN requested.
                  </Text>
                </View>
              )}
          </View>
        </View>

        {/* Timer Section - Shows after redemption is initiated */}
        {sessionStatus !== "idle" && currentSession && (
          <View className="px-5 mb-6">
            <View className="bg-[#1A1A1A] rounded-2xl p-5">
              <Text className="text-white text-lg font-bold mb-4">
                Processing Status
              </Text>

              {/* Status Indicator */}
              <View className="flex-row items-center mb-4">
                <View className={`w-3 h-3 rounded-full mr-3 ${
                  sessionStatus === "waiting" ? "bg-[#FFCC00]" 
                  : sessionStatus === "processing" ? "bg-blue-500"
                  : "bg-green-500"
                }`} />
                <Text className="text-white font-semibold">
                  {sessionStatus === "waiting" ? "Waiting for Customer Approval" 
                   : sessionStatus === "processing" ? "Processing Redemption"
                   : "Redemption Completed"}
                </Text>
              </View>

              {/* Customer Notification Info */}
              <View className="bg-blue-500/10 rounded-xl p-4 mb-4 border border-blue-500/20">
                <View className="flex-row items-start">
                  <MaterialIcons name="notifications" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
                  <View className="flex-1">
                    <Text className="text-blue-400 font-semibold text-sm mb-1">
                      Request Sent to Customer
                    </Text>
                    <Text className="text-blue-300/80 text-xs">
                      Customer has received a notification to approve this redemption request. They have 5 minutes to respond.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Timer Display */}
              {(sessionStatus === "waiting" || sessionStatus === "processing") && (
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
                        {sessionStatus === "waiting" ? "Time Remaining for Customer" : "Processing Time"}
                      </Text>
                    </View>
                    <Text className="text-red-400 text-xl font-mono font-bold">
                      {timeRemaining}
                    </Text>
                  </View>
                </View>
              )}

              {/* Session Details */}
              <View className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-700">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-400 text-sm">Amount</Text>
                  <Text className="text-[#FFCC00] font-bold">
                    -{currentSession.amount} RCN
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2">
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

              {/* Action Buttons */}
              <View className="mt-4">
                {sessionStatus === "waiting" && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (currentSession) {
                        try {
                          await cancelRedemptionSession(currentSession.sessionId);
                          Alert.alert("Success", "Redemption request cancelled");
                        } catch (error) {
                          Alert.alert(
                            "Error", 
                            error instanceof Error ? error.message : "Failed to cancel request"
                          );
                        }
                      }
                      setCurrentSession(null);
                      setSessionStatus("idle");
                      setTimeRemaining("");
                      setIsProcessingRedemption(false);
                    }}
                    className="bg-gray-700 py-3 rounded-xl"
                  >
                    <Text className="text-white font-semibold text-center">
                      Cancel Request
                    </Text>
                  </TouchableOpacity>
                )}

                {sessionStatus === "processing" && (
                  <View>
                    <View className="flex-row items-center justify-center py-3 mb-3">
                      <ActivityIndicator size="small" color="#FFCC00" style={{ marginRight: 8 }} />
                      <Text className="text-[#FFCC00] font-semibold">
                        Customer Approved - Processing...
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setTimeRemaining("00:00");
                        setSessionStatus("completed");
                        setIsProcessingRedemption(false);
                        Alert.alert("Success", "Redemption completed manually!");
                      }}
                      className="bg-green-600 py-2 rounded-lg"
                    >
                      <Text className="text-white font-semibold text-center text-sm">
                        Complete Now (Test)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {sessionStatus === "completed" && (
                  <TouchableOpacity
                    onPress={() => {
                      setCustomerAddress("");
                      setCustomerInfo(null);
                      setRedemptionAmount("");
                      setCurrentSession(null);
                      setSessionStatus("idle");
                      setTimeRemaining("");
                      setIsProcessingRedemption(false);
                    }}
                    className="bg-[#FFCC00] py-3 rounded-xl"
                  >
                    <Text className="text-black font-semibold text-center">
                      Process Another Redemption
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom Process Redemption Button - Hide when timer is active */}
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
            disabled={
              isProcessingRedemption ||
              !customerAddress ||
              !customerInfo ||
              !redemptionAmount ||
              parseFloat(redemptionAmount) <= 0
            }
            className={`py-4 rounded-xl flex-row items-center justify-center mb-4 ${
              isProcessingRedemption ||
              !customerAddress ||
              !customerInfo ||
              !redemptionAmount ||
              parseFloat(redemptionAmount) <= 0
                ? "bg-gray-800"
                : "bg-red-500"
            }`}
          >
            {isProcessingRedemption ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialIcons
                  name="payments"
                  size={20}
                  color={
                    !customerAddress || !customerInfo || !redemptionAmount
                      ? "#4B5563"
                      : "#FFF"
                  }
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={`font-bold text-lg ${
                    !customerAddress || !customerInfo || !redemptionAmount
                      ? "text-gray-500"
                      : "text-white"
                  }`}
                >
                  {!customerAddress
                    ? "Enter Customer Address"
                    : !customerInfo
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
                  title: "Verify Balance",
                  desc: "System checks if customer has sufficient RCN balance",
                },
                {
                  icon: "check-circle",
                  title: "Process Redemption",
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
    </ThemedView>
  );
}
