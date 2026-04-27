import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import Screen from "@/shared/components/ui/Screen";
import { Ionicons } from "@expo/vector-icons";
import { useShopSuspended } from "../hooks/useShopSuspended";

export default function ShopSuspendedScreen() {
  const { userProfile, isChecking, handleLogout, handleCheckStatus } =
    useShopSuspended();

  const reason =
    userProfile?.suspensionReason || userProfile?.suspension_reason;
  const suspendedAt =
    userProfile?.suspendedAt || userProfile?.suspended_at;

  return (
    <Screen>
      <View className="flex-1 px-8 py-12 items-center justify-center">
        <View className="mb-8">
          <View className="bg-red-500/20 rounded-full p-8">
            <Ionicons name="warning-outline" size={80} color="#F87171" />
          </View>
        </View>

        <Text className="text-white text-3xl font-bold text-center mb-4">
          Shop Suspended
        </Text>

        <Text className="text-gray-300 text-lg text-center mb-6 px-4">
          Your shop account has been suspended. You can't access the dashboard
          until this is resolved.
        </Text>

        {userProfile?.shopId && (
          <View className="bg-gray-800 rounded-xl p-4 mb-4 w-full">
            <Text className="text-gray-400 text-sm mb-1">Shop ID</Text>
            <Text className="text-white font-medium">{userProfile.shopId}</Text>
          </View>
        )}

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

        <View className="w-full space-y-3">
          <TouchableOpacity
            onPress={handleCheckStatus}
            disabled={isChecking}
            className="bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center"
          >
            {isChecking ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text className="text-black font-semibold text-lg">
                Check Status
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            className="bg-gray-700 rounded-xl py-4 items-center mt-3"
          >
            <Text className="text-white font-medium text-lg">Logout</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-gray-500 text-sm text-center mt-8">
          Need help? Contact support at{"\n"}
          <Text className="text-yellow-500">support@repaircoin.com</Text>
        </Text>
      </View>
    </Screen>
  );
}
