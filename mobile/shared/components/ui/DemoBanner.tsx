import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";
import apiClient from "@/shared/utilities/axios";

export function DemoBanner() {
  const isDemo = useAuthStore((s) => s.isDemo);
  const resetState = useAuthStore((s) => s.resetState);

  if (!isDemo) return null;

  const handleExit = () => {
    apiClient.setAuthToken("");
    resetState();
    router.replace("/(auth)/connect");
  };

  return (
    <View className="bg-yellow-500 px-4 py-2 flex-row items-center justify-between rounded-lg mb-2">
      <Text className="text-black text-xs font-bold flex-1">
        Demo Mode — Browse only. Sign in with a wallet for full access.
      </Text>
      <TouchableOpacity onPress={handleExit} className="ml-2 bg-black/20 px-3 py-1 rounded-full">
        <Text className="text-black text-xs font-bold">Exit</Text>
      </TouchableOpacity>
    </View>
  );
}
