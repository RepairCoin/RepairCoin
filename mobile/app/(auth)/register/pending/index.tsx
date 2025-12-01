import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import Screen from '@/components/ui/Screen';
import { Ionicons } from '@expo/vector-icons';

export default function ShopPendingApproval() {
  const logout = useAuthStore((state) => state.logout);
  const userProfile = useAuthStore((state) => state.userProfile);

  const handleLogout = () => {
    logout();
    router.replace('/onboarding1');
  };

  const handleRefresh = async () => {
    // Check if shop is now verified
    const checkStoredAuth = useAuthStore.getState().checkStoredAuth;
    await checkStoredAuth();
    
    // If still not active, stay on this page
    const isActive = useAuthStore.getState().userProfile?.isActive;
    if (isActive) {
      router.replace('/shop/tabs/home');
    }
  };

  return (
    <Screen>
      <View className="flex-1 px-8 py-12 items-center justify-center">
        {/* Icon or Logo */}
        <View className="mb-8">
          <View className="bg-yellow-500/20 rounded-full p-8">
            <Ionicons name="time-outline" size={80} color="#FCD34D" />
          </View>
        </View>

        {/* Title */}
        <Text className="text-white text-3xl font-bold text-center mb-4">
          Application Pending
        </Text>

        {/* Description */}
        <Text className="text-gray-300 text-lg text-center mb-8 px-4">
          Please wait for approval from the admin.
        </Text>

        {/* Shop Info */}
        {userProfile?.shopId && (
          <View className="bg-gray-800 rounded-xl p-4 mb-8 w-full">
            <Text className="text-gray-400 text-sm mb-1">Shop ID</Text>
            <Text className="text-white font-medium">{userProfile.shopId}</Text>
          </View>
        )}

        {/* Additional Info */}
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-8 w-full">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3B82F6" />
            <Text className="text-blue-300 text-sm ml-2 flex-1">
              Your shop registration is under review. You will receive an email notification once your application has been approved.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="w-full space-y-3">
          {/* Logout Button */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-gray-700 rounded-xl py-4 items-center"
          >
            <Text className="text-white font-medium text-lg">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Support Info */}
        <Text className="text-gray-500 text-sm text-center mt-8">
          Need help? Contact support at{'\n'}
          <Text className="text-yellow-500">support@repaircoin.com</Text>
        </Text>
      </View>
    </Screen>
  );
}