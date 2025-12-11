import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { usePaymentStore } from "@/store/payment.store";
import { useAuthStore } from "@/store/auth.store";

export default function PaymentCancel() {
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const userType = useAuthStore((state) => state.userType);
  const clearSession = usePaymentStore((state) => state.clearSession);
  const activeSession = usePaymentStore((state) => state.activeSession);

  const [paymentType, setPaymentType] = useState<string | null>(null);

  useEffect(() => {
    // Capture the payment type before clearing
    if (activeSession) {
      setPaymentType(activeSession.type);
    }
    // Clear the session on cancel
    clearSession();
  }, []);

  const handleTryAgain = () => {
    // Navigate back based on payment type
    if (paymentType === "service_booking") {
      router.replace("/customer/tabs/service" as any);
    } else if (paymentType === "token_purchase") {
      router.replace("/shop/buy-token" as any);
    } else if (paymentType === "subscription") {
      router.replace("/shop/subscription-form" as any);
    } else {
      // Default - go to home based on user type
      const homePath = userType === "shop"
        ? "/shop/tabs/home"
        : "/customer/tabs/home";
      router.replace(homePath as any);
    }
  };

  const handleBackToHome = () => {
    const homePath = userType === "shop"
      ? "/shop/tabs/home"
      : "/customer/tabs/home";
    router.replace(homePath as any);
  };

  // Get appropriate messaging based on payment type
  const getMessage = () => {
    switch (paymentType) {
      case "service_booking":
        return {
          title: "Booking Cancelled",
          subtitle: "Your service booking was not completed.",
          tryAgainText: "Browse Services",
        };
      case "token_purchase":
        return {
          title: "Purchase Cancelled",
          subtitle: "Your token purchase was not completed.",
          tryAgainText: "Try Again",
        };
      case "subscription":
        return {
          title: "Subscription Cancelled",
          subtitle: "Your subscription was not activated.",
          tryAgainText: "Try Again",
        };
      default:
        return {
          title: "Payment Cancelled",
          subtitle: "Your payment was not completed.",
          tryAgainText: "Try Again",
        };
    }
  };

  const message = getMessage();

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Cancel Content */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Cancel Icon */}
        <View className="w-24 h-24 bg-red-500/20 rounded-full items-center justify-center mb-6">
          <View className="w-16 h-16 bg-red-500 rounded-full items-center justify-center">
            <Ionicons name="close" size={40} color="white" />
          </View>
        </View>

        {/* Cancel Message */}
        <Text className="text-white text-2xl font-bold text-center mb-2">
          {message.title}
        </Text>
        <Text className="text-gray-400 text-center mb-8 px-4">
          {message.subtitle}
        </Text>

        {/* Info Card */}
        <View className="w-full bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 mb-8">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-blue-500/20 rounded-full items-center justify-center mr-3">
              <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-medium">No Charges Made</Text>
              <Text className="text-gray-500 text-sm">Your payment method was not charged</Text>
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
          <Text className="text-black text-lg font-bold ml-2">{message.tryAgainText}</Text>
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
