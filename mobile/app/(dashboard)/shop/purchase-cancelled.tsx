import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";

export default function PurchaseCancelled() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect after 5 seconds if user doesn't take action
    const timeout = setTimeout(() => {
      router.replace("/(dashboard)/shop/tabs/home");
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  const handleRetry = () => {
    router.replace("/(dashboard)/shop/buy-token");
  };

  const handleGoHome = () => {
    router.replace("/(dashboard)/shop/tabs/home");
  };

  return (
    <ThemedView className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
        {/* Warning Icon */}
        <View className="bg-yellow-500/20 rounded-full p-6 mb-6">
          <Ionicons name="warning-outline" size={80} color="#F59E0B" />
        </View>

        {/* Cancelled Message */}
        <Text className="text-white text-3xl font-bold text-center mb-2">
          Purchase Cancelled
        </Text>
        
        <Text className="text-gray-400 text-base text-center mb-8 px-4">
          Your purchase was cancelled. No charges were made to your account.
        </Text>

        {/* Info Card */}
        <View className="bg-[#1A1A1A] rounded-2xl p-5 mb-8 w-full">
          <Text className="text-white font-semibold mb-2">
            Why was this cancelled?
          </Text>
          <View className="space-y-2">
            <Text className="text-gray-400 text-sm">
              • You closed the payment window
            </Text>
            <Text className="text-gray-400 text-sm">
              • Payment was not completed
            </Text>
            <Text className="text-gray-400 text-sm">
              • Session timed out
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="w-full space-y-3">
          <TouchableOpacity
            onPress={handleRetry}
            className="bg-[#FFCC00] rounded-2xl py-4"
          >
            <Text className="text-black text-center font-bold text-lg">
              Try Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleGoHome}
            className="bg-[#1A1A1A] rounded-2xl py-4 border border-gray-700"
          >
            <Text className="text-white text-center font-semibold text-lg">
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <Text className="text-gray-500 text-xs text-center mt-6">
          Need help? Contact support@repaircoin.com
        </Text>
      </View>
    </ThemedView>
  );
}