import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Screen from "@/shared/components/ui/Screen";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { router } from "expo-router";

export default function CustomerSuspendedScreen() {
  const { userProfile, resetState } = useAuthStore();

  const reason = userProfile?.suspensionReason || userProfile?.suspension_reason;
  const suspendedAt = userProfile?.suspendedAt || userProfile?.suspended_at;

  const handleLogout = () => {
    resetState();
    router.replace("/connect");
  };

  return (
    <Screen>
      <View className="flex-1 px-8 py-12 items-center justify-center">
        <View className="mb-8">
          <View className="bg-red-500/20 rounded-full p-8">
            <Ionicons name="ban-outline" size={80} color="#F87171" />
          </View>
        </View>

        <Text className="text-white text-3xl font-bold text-center mb-4">
          Account Suspended
        </Text>

        <Text className="text-gray-300 text-lg text-center mb-6 px-4">
          Your account has been suspended. You cannot earn or redeem tokens
          while suspended.
        </Text>

        {!!reason && (
          <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 w-full">
            <Text className="text-red-300 text-sm font-semibold mb-1">
              Reason
            </Text>
            <Text className="text-red-200 text-sm">{reason}</Text>
          </View>
        )}

        {!!suspendedAt && (
          <View className="bg-gray-800 rounded-xl p-4 mb-8 w-full">
            <Text className="text-gray-400 text-sm mb-1">Suspended on</Text>
            <Text className="text-white font-medium">
              {new Date(suspendedAt).toLocaleString()}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleLogout}
          className="bg-gray-700 rounded-xl py-4 items-center w-full mt-3"
        >
          <Text className="text-white font-medium text-lg">Logout</Text>
        </TouchableOpacity>

        <Text className="text-gray-500 text-sm text-center mt-8">
          Need help? Contact support at{"\n"}
          <Text className="text-yellow-500">support@repaircoin.com</Text>
        </Text>
      </View>
    </Screen>
  );
}
