import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useBookingStore } from "@/store/booking.store";

export default function BookingCancel() {
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const validateAndConsumeSession = useBookingStore((state) => state.validateAndConsumeSession);

  // Check if this is a valid fresh session from Stripe checkout
  useEffect(() => {
    if (!order_id) {
      // No order_id, redirect immediately
      router.replace("/customer/tabs/home" as any);
      return;
    }

    // Validate the session using Zustand store
    const isValid = validateAndConsumeSession(order_id);

    if (isValid) {
      setIsValidSession(true);
    } else {
      // Stale navigation - redirect to home
      setIsValidSession(false);
      router.replace("/customer/tabs/home" as any);
    }
  }, [order_id, validateAndConsumeSession]);

  const handleTryAgain = () => {
    // Go back to marketplace to try booking again
    router.replace("/customer/tabs/service" as any);
  };

  const handleBackToHome = () => {
    router.replace("/customer/tabs/home" as any);
  };

  const handleContactSupport = () => {
    // Could open support chat or email in the future
    router.replace("/customer/tabs/home" as any);
  };

  // Show nothing while checking or if invalid session
  if (isValidSession !== true) {
    return null;
  }

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Cancelled Content */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Cancelled Icon */}
        <View className="w-24 h-24 bg-red-500/20 rounded-full items-center justify-center mb-6">
          <View className="w-16 h-16 bg-red-500 rounded-full items-center justify-center">
            <Ionicons name="close" size={40} color="white" />
          </View>
        </View>

        {/* Cancelled Message */}
        <Text className="text-white text-2xl font-bold text-center mb-2">
          Payment Cancelled
        </Text>
        <Text className="text-gray-400 text-center mb-8 px-4">
          Your payment was cancelled and no charges were made. Your booking has not been confirmed.
        </Text>

        {/* Order Info Card */}
        {order_id && (
          <View className="w-full bg-zinc-900 rounded-2xl p-4 mb-8 border border-zinc-800">
            <View className="flex-row items-center mb-3">
              <Ionicons name="receipt-outline" size={20} color="#EF4444" />
              <Text className="text-gray-400 text-sm ml-2">Cancelled Order</Text>
            </View>
            <Text className="text-white font-mono text-sm" numberOfLines={1}>
              {order_id}
            </Text>
          </View>
        )}

        {/* Info Cards */}
        <View className="w-full space-y-3 mb-8">
          <View className="flex-row items-center bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <View className="w-10 h-10 bg-green-500/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="shield-checkmark-outline" size={20} color="#22C55E" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">No Charges Made</Text>
              <Text className="text-gray-500 text-sm">Your payment method was not charged</Text>
            </View>
          </View>

          <View className="flex-row items-center bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <View className="w-10 h-10 bg-blue-500/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="refresh-outline" size={20} color="#60A5FA" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">Try Again</Text>
              <Text className="text-gray-500 text-sm">You can book the service again anytime</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Buttons */}
      <View className="px-6 pb-8">
        <TouchableOpacity
          onPress={handleTryAgain}
          className="bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center mb-3"
          activeOpacity={0.8}
        >
          <Feather name="refresh-cw" size={20} color="#000" />
          <Text className="text-black text-lg font-bold ml-2">Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleBackToHome}
          className="bg-zinc-800 rounded-xl py-4 items-center flex-row justify-center mb-3"
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={20} color="white" />
          <Text className="text-white text-lg font-semibold ml-2">Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleContactSupport}
          className="py-3 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-gray-500 text-sm">
            Need help? <Text className="text-[#FFCC00]">Contact Support</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
