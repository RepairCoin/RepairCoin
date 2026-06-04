import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";

export default function SubscriptionCancel() {
  const router = useRouter();

  return (
    <ThemedView className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-red-500/20 rounded-full p-6 mb-6">
          <Ionicons name="close-circle" size={80} color="#EF4444" />
        </View>

        <Text className="text-white text-3xl font-bold text-center mb-2">
          Subscription Cancelled
        </Text>

        <Text className="text-gray-400 text-base text-center mb-8 px-4">
          You cancelled the subscription process. You can try again whenever
          you're ready.
        </Text>

        <View className="w-full gap-3">
          <TouchableOpacity
            onPress={() => router.replace("/(dashboard)/shop/subscription-form")}
            className="bg-[#FFCC00] rounded-2xl py-4"
          >
            <Text className="text-black text-center font-bold text-lg">
              Try Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(dashboard)/shop/tabs/home")}
            className="bg-[#1A1A1A] rounded-2xl py-4 border border-gray-700"
          >
            <Text className="text-white text-center font-semibold text-lg">
              Go to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}
