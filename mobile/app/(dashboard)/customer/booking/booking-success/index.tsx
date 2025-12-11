import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useBookingStore } from "@/store/booking.store";
import { bookingApi } from "@/services/booking.services";

export default function BookingSuccess() {
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const validateAndConsumeSession = useBookingStore((state) => state.validateAndConsumeSession);

  // Check if this is a valid fresh session from Stripe checkout and confirm payment
  useEffect(() => {
    const validateAndConfirm = async () => {
      if (!order_id) {
        // No order_id, redirect immediately
        router.replace("/customer/tabs/home" as any);
        return;
      }

      // Validate the session using Zustand store - returns sessionId if valid
      const sessionId = validateAndConsumeSession(order_id);

      if (sessionId) {
        setIsValidSession(true);
        setIsConfirming(true);

        // Call the confirm endpoint to update order status and process RCN redemption
        try {
          const result = await bookingApi.confirmCheckoutPayment(sessionId);
          if (!result.success) {
            console.error("Failed to confirm payment:", result.error);
            setConfirmError(result.error || "Failed to confirm payment");
          } else {
            console.log("Payment confirmed successfully");
          }
        } catch (error: any) {
          console.error("Error confirming payment:", error);
          setConfirmError(error.message || "Failed to confirm payment");
        } finally {
          setIsConfirming(false);
        }
      } else {
        // Stale navigation - redirect to home
        setIsValidSession(false);
        router.replace("/customer/tabs/home" as any);
      }
    };

    validateAndConfirm();
  }, [order_id, validateAndConsumeSession]);

  const handleViewBookings = () => {
    router.replace("/customer/tabs/service/tabs/bookings" as any);
  };

  const handleBackToHome = () => {
    router.replace("/customer/tabs/home" as any);
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
        <Text className="text-gray-400 text-sm mt-2">Please wait while we process your booking</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Success Content */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Success/Error Icon */}
        {confirmError ? (
          <View className="w-24 h-24 bg-orange-500/20 rounded-full items-center justify-center mb-6">
            <View className="w-16 h-16 bg-orange-500 rounded-full items-center justify-center">
              <Ionicons name="warning" size={40} color="white" />
            </View>
          </View>
        ) : (
          <View className="w-24 h-24 bg-green-500/20 rounded-full items-center justify-center mb-6">
            <View className="w-16 h-16 bg-green-500 rounded-full items-center justify-center">
              <Ionicons name="checkmark" size={40} color="white" />
            </View>
          </View>
        )}

        {/* Success/Error Message */}
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
          <View className="w-full bg-zinc-900 rounded-2xl p-4 mb-8 border border-zinc-800">
            <View className="flex-row items-center mb-3">
              <Ionicons name="receipt-outline" size={20} color="#FFCC00" />
              <Text className="text-gray-400 text-sm ml-2">Order Reference</Text>
            </View>
            <Text className="text-white font-mono text-sm" numberOfLines={1}>
              {order_id}
            </Text>
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
      </View>

      {/* Bottom Buttons */}
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
          onPress={handleBackToHome}
          className="bg-zinc-800 rounded-xl py-4 items-center flex-row justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="home-outline" size={20} color="white" />
          <Text className="text-white text-lg font-semibold ml-2">Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
