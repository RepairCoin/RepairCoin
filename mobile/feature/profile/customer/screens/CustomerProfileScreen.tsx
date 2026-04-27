import { useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import {
  ProfileLoadingState,
  ProfileErrorState,
  CustomerProfileHeader,
  CustomerStats,
  CustomerContactInfo
} from "../components";
import { useCustomerProfileScreen } from "../hooks/ui";
import { useLocalSearchParams } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAppToast } from "@/shared/hooks/useAppToast";

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showError } = useAppToast();
  const [sendingMessage, setSendingMessage] = useState(false);

  const {
    customerData,
    isLoading,
    error,
    goBack
  } = useCustomerProfileScreen(id);

  const handleSendMessage = useCallback(async () => {
    if (sendingMessage || !customerData?.address) return;

    try {
      setSendingMessage(true);
      const response = await messageApi.getOrCreateConversation(customerData.address);

      if (response.success && response.data) {
        router.push(`/shop/messages/${response.data.conversationId}` as any);
      }
    } catch (err) {
      showError("Failed to open conversation. Please try again.");
    } finally {
      setSendingMessage(false);
    }
  }, [sendingMessage, customerData?.address, showError]);

  if (isLoading) {
    return <ProfileLoadingState message="Loading customer profile..." />;
  }

  if (error || !customerData) {
    return (
      <ProfileErrorState
        title="Customer not found"
        message="The customer you're looking for doesn't exist"
        onBack={goBack}
      />
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Customer Profile" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="h-4" />

        <CustomerProfileHeader
          name={customerData.name}
          tier={customerData.tier}
          profileImageUrl={customerData.profileImageUrl}
        />

        <CustomerStats
          lifetimeEarnings={customerData.lifetimeEarnings}
          totalRedemptions={customerData.totalRedemptions}
          totalRepairs={customerData.totalRepairs}
        />

        <CustomerContactInfo
          email={customerData.email}
          phone={customerData.phone}
          walletAddress={customerData.address}
        />

        {/* Send Message Button */}
        <View className="px-4 mb-6">
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={sendingMessage}
            className={`flex-row items-center justify-center py-4 rounded-xl ${
              sendingMessage ? "bg-blue-500/50" : "bg-blue-500"
            }`}
            activeOpacity={0.8}
          >
            {sendingMessage ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">
                  Send Message
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
