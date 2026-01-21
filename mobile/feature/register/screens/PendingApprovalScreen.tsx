import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Screen from "@/components/ui/Screen";
import { Ionicons } from "@expo/vector-icons";
import { usePendingApproval } from "../hooks";

export default function PendingApprovalScreen() {
  const { userProfile, handleLogout } = usePendingApproval();

  return (
    <Screen>
      <View className="flex-1 px-8 py-12 items-center justify-center">
        <View className="mb-8">
          <View className="bg-yellow-500/20 rounded-full p-8">
            <Ionicons name="time-outline" size={80} color="#FCD34D" />
          </View>
        </View>

        <Text className="text-white text-3xl font-bold text-center mb-4">
          Application Pending
        </Text>

        <Text className="text-gray-300 text-lg text-center mb-8 px-4">
          Please wait for approval from the admin.
        </Text>

        {userProfile?.shopId && (
          <View className="bg-gray-800 rounded-xl p-4 mb-8 w-full">
            <Text className="text-gray-400 text-sm mb-1">Shop ID</Text>
            <Text className="text-white font-medium">{userProfile.shopId}</Text>
          </View>
        )}

        <View className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-8 w-full">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text className="text-blue-300 text-sm ml-2 flex-1">
              Your shop registration is under review. You will receive an email
              notification once your application has been approved.
            </Text>
          </View>
        </View>

        <View className="w-full space-y-3">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-gray-700 rounded-xl py-4 items-center"
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
