import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/shared/components/ui/ThemedView";
import { useQueryClient } from "@tanstack/react-query";

export default function SubscriptionSuccess() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["shopSubscription"] });
    queryClient.invalidateQueries({ queryKey: ["shopByWalletAddress"] });
    queryClient.invalidateQueries({ queryKey: ["shop"] });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      router.replace("/(dashboard)/shop/tabs/home");
    }
  }, [countdown]);

  return (
    <ThemedView className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-green-500/20 rounded-full p-6 mb-6">
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        </View>

        <Text className="text-white text-3xl font-bold text-center mb-2">
          Subscription Active!
        </Text>

        <Text className="text-gray-400 text-base text-center mb-8 px-4">
          Your $500/month subscription is now active. You can start creating
          services and rewarding customers.
        </Text>

        <View className="bg-[#1A1A1A] rounded-2xl p-6 mb-8 w-full border border-[#FFCC00]/30">
          <View className="flex-row items-center justify-center mb-2">
            <Ionicons name="star" size={24} color="#FFCC00" />
            <Text className="text-[#FFCC00] text-lg font-semibold ml-2">
              What's included
            </Text>
          </View>
          <Text className="text-gray-300 text-sm text-center">
            Unlimited services · Standard RCN pricing · No upfront token purchase
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.replace("/(dashboard)/shop/tabs/home")}
          className="bg-[#FFCC00] rounded-2xl py-4 w-full"
        >
          <Text className="text-black text-center font-bold text-lg">
            Go to Dashboard ({countdown}s)
          </Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}
