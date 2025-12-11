import { View, Text, TouchableOpacity, ActivityIndicator, Animated, Easing } from "react-native";
import { Ionicons, Feather, FontAwesome5 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePaymentStore, PaymentType, waitForPaymentStoreHydration } from "@/store/payment.store";
import { useAuthStore } from "@/store/auth.store";
import { bookingApi } from "@/services/booking.services";

export default function PaymentSuccess() {
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const queryClient = useQueryClient();
  const userType = useAuthStore((state) => state.userType);
  const validateAndConsumeSession = usePaymentStore((state) => state.validateAndConsumeSession);

  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [sessionData, setSessionData] = useState<{
    amount?: number;
    rcnRedeemed?: number;
    serviceName?: string;
    shopName?: string;
    tokenAmount?: number;
    totalCost?: number;
  } | null>(null);

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;

  // Start animations
  const startAnimations = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(checkmarkAnim, {
      toValue: 1,
      duration: 400,
      delay: 200,
      useNativeDriver: true,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Validate session and confirm payment
  useEffect(() => {
    const validateAndConfirm = async () => {
      if (!order_id) {
        router.replace("/customer/tabs/home" as any);
        return;
      }

      // Wait for store to hydrate from AsyncStorage
      await waitForPaymentStoreHydration();

      // Validate the session using the payment store
      const session = validateAndConsumeSession(order_id);

      if (session) {
        setIsValidSession(true);
        setPaymentType(session.type);
        setSessionData({
          amount: session.amount,
          rcnRedeemed: session.rcnRedeemed,
          serviceName: session.serviceName,
          shopName: session.shopName,
          tokenAmount: session.tokenAmount,
          totalCost: session.totalCost,
        });
        setIsConfirming(true);

        try {
          // Call the appropriate confirm endpoint based on payment type
          if (session.type === "service_booking") {
            const result = await bookingApi.confirmCheckoutPayment(session.sessionId);
            if (!result.success) {
              setConfirmError(result.error || "Failed to confirm payment");
            } else {
              // Invalidate booking queries
              await queryClient.invalidateQueries({ queryKey: ["bookings"] });
              await queryClient.invalidateQueries({ queryKey: ["customerBalance"] });
            }
          } else if (session.type === "token_purchase") {
            // Token purchase is confirmed via webhook, but we refresh data
            await queryClient.invalidateQueries({ queryKey: ["shopByWalletAddress"] });
            await queryClient.invalidateQueries({ queryKey: ["shopTokens"] });
            await queryClient.invalidateQueries({ queryKey: ["shopPurchases"] });
            await queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
          } else if (session.type === "subscription") {
            // Subscription is confirmed via webhook, but we refresh data
            await queryClient.invalidateQueries({ queryKey: ["shopByWalletAddress"] });
            await queryClient.invalidateQueries({ queryKey: ["shop"] });
            await queryClient.invalidateQueries({ queryKey: ["shops"] });
          }

          startAnimations();
        } catch (error: any) {
          setConfirmError(error.message || "Failed to confirm payment");
          startAnimations();
        } finally {
          setIsConfirming(false);
        }
      } else {
        // Stale navigation - redirect to appropriate home
        setIsValidSession(false);
        const redirectPath = userType === "shop"
          ? "/shop/tabs/home"
          : "/customer/tabs/home";
        router.replace(redirectPath as any);
      }
    };

    validateAndConfirm();
  }, [order_id, validateAndConsumeSession]);

  // Navigation handlers
  const handleViewBookings = () => {
    router.replace("/customer/tabs/service/tabs/bookings" as any);
  };

  const handleCustomerHome = () => {
    router.replace("/customer/tabs/home" as any);
  };

  const handleShopDashboard = () => {
    router.replace("/shop/tabs/home" as any);
  };

  const handleBuyMoreTokens = () => {
    router.replace("/shop/buy-token" as any);
  };

  // Show nothing while checking or if invalid session
  if (isValidSession !== true) {
    return null;
  }

  // Show loading state while confirming payment
  if (isConfirming) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-white text-lg mt-4">Confirming your payment...</Text>
        <Text className="text-gray-400 text-sm mt-2">Please wait while we process your transaction</Text>
      </View>
    );
  }

  // Render content based on payment type
  const renderContent = () => {
    switch (paymentType) {
      case "service_booking":
        return renderBookingSuccess();
      case "token_purchase":
        return renderTokenPurchaseSuccess();
      case "subscription":
        return renderSubscriptionSuccess();
      default:
        return renderGenericSuccess();
    }
  };

  // Service Booking Success
  const renderBookingSuccess = () => (
    <>
      {/* Success/Error Icon */}
      <Animated.View
        style={{ transform: [{ scale: scaleAnim }] }}
        className={`w-24 h-24 ${confirmError ? "bg-orange-500/20" : "bg-green-500/20"} rounded-full items-center justify-center mb-6`}
      >
        <Animated.View
          style={{
            opacity: checkmarkAnim,
            transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }}
          className={`w-16 h-16 ${confirmError ? "bg-orange-500" : "bg-green-500"} rounded-full items-center justify-center`}
        >
          <Ionicons name={confirmError ? "warning" : "checkmark"} size={40} color="white" />
        </Animated.View>
      </Animated.View>

      {/* Success/Error Message */}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {confirmError ? (
          <>
            <Text className="text-white text-2xl font-bold text-center mb-2">
              Payment Received
            </Text>
            <Text className="text-orange-400 text-center mb-4 px-4">
              Your payment was received but we encountered an issue confirming your booking.
            </Text>
            <Text className="text-gray-500 text-sm text-center mb-8 px-4">
              Don't worry - your booking is being processed. Please check your bookings in a few minutes.
            </Text>
          </>
        ) : (
          <>
            <Text className="text-white text-2xl font-bold text-center mb-2">
              Booking Confirmed!
            </Text>
            <Text className="text-gray-400 text-center mb-8 px-4">
              Your payment was successful and your service booking has been confirmed.
            </Text>
          </>
        )}

        {/* Order Info Card */}
        {order_id && (
          <View className="w-full bg-zinc-900 rounded-2xl p-4 mb-6 border border-zinc-800">
            <View className="flex-row items-center mb-3">
              <Ionicons name="receipt-outline" size={20} color="#FFCC00" />
              <Text className="text-gray-400 text-sm ml-2">Order Reference</Text>
            </View>
            <Text className="text-white font-mono text-sm" numberOfLines={1}>
              {order_id}
            </Text>
          </View>
        )}

        {/* RCN Redeemed Info */}
        {sessionData?.rcnRedeemed && sessionData.rcnRedeemed > 0 && (
          <View className="w-full bg-[#FFCC00]/10 rounded-2xl p-4 mb-6 border border-[#FFCC00]/30">
            <View className="flex-row items-center justify-center">
              <FontAwesome5 name="coins" size={20} color="#FFCC00" />
              <Text className="text-[#FFCC00] font-semibold ml-2">
                {sessionData.rcnRedeemed} RCN Redeemed
              </Text>
            </View>
          </View>
        )}

        {/* Info Cards */}
        <View className="w-full space-y-3 mb-8">
          <View className="flex-row items-center bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <View className="w-10 h-10 bg-blue-500/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="notifications-outline" size={20} color="#60A5FA" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">Notification Sent</Text>
              <Text className="text-gray-500 text-sm">The shop has been notified of your booking</Text>
            </View>
          </View>

          <View className="flex-row items-center bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <View className="w-10 h-10 bg-[#FFCC00]/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="calendar-outline" size={20} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">Check Your Bookings</Text>
              <Text className="text-gray-500 text-sm">View appointment details in My Bookings</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </>
  );

  // Token Purchase Success
  const renderTokenPurchaseSuccess = () => (
    <>
      <Animated.View
        style={{ transform: [{ scale: scaleAnim }] }}
        className="w-32 h-32 rounded-full bg-green-500/20 items-center justify-center mb-8"
      >
        <View className="w-24 h-24 rounded-full bg-green-500/40 items-center justify-center">
          <Animated.View
            style={{
              opacity: checkmarkAnim,
              transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            }}
            className="w-16 h-16 rounded-full bg-green-500 items-center justify-center"
          >
            <Feather name="check" size={40} color="white" />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        className="items-center w-full"
      >
        <Text className="text-[#FFCC00] text-3xl font-bold text-center mb-2">
          Purchase Successful!
        </Text>
        <Text className="text-gray-300 text-lg text-center mb-8">
          {sessionData?.tokenAmount?.toLocaleString() || "Your"} RCN tokens have been added to your wallet
        </Text>

        {/* Transaction ID */}
        {order_id && (
          <View className="bg-[#1A1A1A] rounded-2xl p-4 mb-4 w-full">
            <Text className="text-gray-500 text-xs uppercase tracking-wider mb-2">
              Transaction ID
            </Text>
            <Text className="text-white text-sm font-mono">
              {order_id.length > 20 ? `${order_id.slice(0, 10)}...${order_id.slice(-10)}` : order_id}
            </Text>
          </View>
        )}

        {/* Token Balance Card */}
        <View className="bg-[#FFCC00]/10 rounded-2xl p-6 mb-6 w-full border border-[#FFCC00]/30">
          <View className="flex-row items-center justify-center">
            <FontAwesome5 name="coins" size={24} color="#FFCC00" />
            <Text className="text-[#FFCC00] text-lg font-semibold ml-3">
              Tokens Ready to Use!
            </Text>
          </View>
          <Text className="text-gray-300 text-sm text-center mt-3">
            Start rewarding your customers immediately
          </Text>
        </View>
      </Animated.View>
    </>
  );

  // Subscription Success
  const renderSubscriptionSuccess = () => (
    <>
      <Animated.View
        style={{ transform: [{ scale: scaleAnim }] }}
        className="w-32 h-32 rounded-full bg-green-500/20 items-center justify-center mb-8"
      >
        <View className="w-24 h-24 rounded-full bg-green-500/40 items-center justify-center">
          <Animated.View
            style={{
              opacity: checkmarkAnim,
              transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            }}
            className="w-16 h-16 rounded-full bg-green-500 items-center justify-center"
          >
            <Feather name="check" size={40} color="white" />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        className="items-center w-full"
      >
        <Text className="text-[#FFCC00] text-3xl font-bold text-center mb-2">
          Subscription Active!
        </Text>
        <Text className="text-gray-300 text-lg text-center mb-8">
          Your subscription has been activated
        </Text>

        {/* Subscription Details */}
        <View className="w-full bg-[#1a1a1a] rounded-2xl p-6 mb-6 border border-gray-800">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-400 text-sm">Plan</Text>
            <Text className="text-white font-semibold">Monthly Subscription</Text>
          </View>
          <View className="h-px bg-gray-800 mb-4" />
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-400 text-sm">Amount Paid</Text>
            <Text className="text-[#FFCC00] font-bold text-lg">$500.00</Text>
          </View>
          <View className="h-px bg-gray-800 mb-4" />
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-gray-400 text-sm">Status</Text>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <Text className="text-green-500 font-semibold">Active</Text>
            </View>
          </View>
          <View className="h-px bg-gray-800 mb-4" />
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-400 text-sm">Next Billing</Text>
            <Text className="text-white font-semibold">
              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </Animated.View>
    </>
  );

  // Generic Success
  const renderGenericSuccess = () => (
    <>
      <Animated.View
        style={{ transform: [{ scale: scaleAnim }] }}
        className="w-24 h-24 bg-green-500/20 rounded-full items-center justify-center mb-6"
      >
        <Animated.View
          style={{
            opacity: checkmarkAnim,
            transform: [{ scale: checkmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }}
          className="w-16 h-16 bg-green-500 rounded-full items-center justify-center"
        >
          <Ionicons name="checkmark" size={40} color="white" />
        </Animated.View>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text className="text-white text-2xl font-bold text-center mb-2">
          Payment Successful!
        </Text>
        <Text className="text-gray-400 text-center mb-8 px-4">
          Your transaction has been completed successfully.
        </Text>
      </Animated.View>
    </>
  );

  // Render action buttons based on payment type
  const renderButtons = () => {
    switch (paymentType) {
      case "service_booking":
        return (
          <View className="px-6 pb-8">
            <TouchableOpacity
              onPress={handleViewBookings}
              className="bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center mb-3"
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={20} color="#000" />
              <Text className="text-black text-lg font-bold ml-2">View My Bookings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCustomerHome}
              className="bg-zinc-800 rounded-xl py-4 items-center flex-row justify-center"
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={20} color="white" />
              <Text className="text-white text-lg font-semibold ml-2">Back to Home</Text>
            </TouchableOpacity>
          </View>
        );

      case "token_purchase":
        return (
          <View className="px-6 pb-8">
            <TouchableOpacity
              onPress={handleShopDashboard}
              className="bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center mb-3"
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={20} color="#000" />
              <Text className="text-black text-lg font-bold ml-2">Go to Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBuyMoreTokens}
              className="bg-zinc-800 rounded-xl py-4 items-center flex-row justify-center border border-gray-700"
              activeOpacity={0.8}
            >
              <FontAwesome5 name="coins" size={18} color="white" />
              <Text className="text-white text-lg font-semibold ml-2">Buy More Tokens</Text>
            </TouchableOpacity>
          </View>
        );

      case "subscription":
        return (
          <View className="px-6 pb-8">
            <TouchableOpacity
              onPress={handleShopDashboard}
              className="bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center"
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={20} color="#000" />
              <Text className="text-black text-lg font-bold ml-2">Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View className="px-6 pb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center"
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={20} color="#000" />
              <Text className="text-black text-lg font-bold ml-2">Continue</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Success Content */}
      <View className="flex-1 items-center justify-center px-6">
        {renderContent()}
      </View>

      {/* Bottom Buttons */}
      {renderButtons()}
    </View>
  );
}
