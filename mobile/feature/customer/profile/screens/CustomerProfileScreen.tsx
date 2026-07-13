import { useState, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, Text, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { appointmentApi } from "@/feature/services/services/service.services";
import {
  CustomerProfileHeader,
  CustomerStats,
  CustomerContactInfo,
  CustomerNoShowRecord
} from "../components";
import { useCustomerProfileScreen } from "../hooks/ui";
import { useLocalSearchParams } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAppToast } from "@/shared/hooks/useAppToast";
import { ProfileErrorState } from "@/shared/components/ui/ProfileErrorState";
import { ProfileLoadingState } from "@/shared/components/ui/ProfileLoadingState";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import ReportCustomerModal from "@/feature/shop/customers/components/ReportCustomerModal";
import BlockCustomerModal from "@/feature/shop/customers/components/BlockCustomerModal";
import {
  useCustomerBlockStatus,
  useUnblockCustomer,
} from "@/feature/shop/customers/hooks/useModeration";

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showError } = useAppToast();
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const isShopOwner = useAuthStore((s) => !!s.userProfile?.shopId);

  const {
    customerData,
    isLoading,
    error,
    goBack
  } = useCustomerProfileScreen(id);

  const customerAddress = customerData?.address;
  const { data: isBlocked } = useCustomerBlockStatus(
    isShopOwner ? customerAddress : undefined
  );
  const { mutate: unblockCustomer } = useUnblockCustomer();

  // Shop owners see the customer's no-show history to inform block/booking decisions.
  const { data: noShowStatus } = useQuery({
    queryKey: ["customerNoShowStatus", customerAddress],
    queryFn: () => appointmentApi.getCustomerNoShowStatus(customerAddress!),
    enabled: isShopOwner && !!customerAddress,
  });

  const handleUnblock = () => {
    if (!customerAddress) return;
    Alert.alert(
      "Unblock Customer",
      `Unblock ${customerData?.name || "this customer"}? They will be able to book again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: () => unblockCustomer(customerAddress),
        },
      ]
    );
  };

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

        {isShopOwner && noShowStatus && (
          <CustomerNoShowRecord
            noShowCount={noShowStatus.noShowCount}
            tier={noShowStatus.tier}
            lastNoShowAt={noShowStatus.lastNoShowAt}
          />
        )}

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

          {/* Moderation actions — shop owners only */}
          {isShopOwner && (
            <>
              <TouchableOpacity
                onPress={() => setShowReportModal(true)}
                className="flex-row items-center justify-center py-4 rounded-xl border border-red-500/40 mt-3"
                activeOpacity={0.8}
              >
                <Ionicons name="flag-outline" size={20} color="#EF4444" />
                <Text className="text-red-400 font-bold text-base ml-2">
                  Report Customer
                </Text>
              </TouchableOpacity>

              {isBlocked ? (
                <TouchableOpacity
                  onPress={handleUnblock}
                  className="flex-row items-center justify-center py-4 rounded-xl bg-zinc-800 mt-3"
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-open-outline" size={20} color="#fff" />
                  <Text className="text-white font-bold text-base ml-2">
                    Unblock Customer
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowBlockModal(true)}
                  className="flex-row items-center justify-center py-4 rounded-xl border border-red-500/40 mt-3"
                  activeOpacity={0.8}
                >
                  <Ionicons name="ban-outline" size={20} color="#EF4444" />
                  <Text className="text-red-400 font-bold text-base ml-2">
                    Block Customer
                  </Text>
                </TouchableOpacity>
              )}

              <View className="flex-row justify-center gap-4 mt-3">
                <TouchableOpacity
                  onPress={() => router.push("/shop/blocked-customers" as any)}
                  className="flex-row items-center py-3"
                  activeOpacity={0.7}
                >
                  <Ionicons name="list-outline" size={16} color="#9CA3AF" />
                  <Text className="text-gray-400 font-medium text-sm ml-2">
                    Blocked customers
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/shop/my-reports" as any)}
                  className="flex-row items-center py-3"
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color="#9CA3AF"
                  />
                  <Text className="text-gray-400 font-medium text-sm ml-2">
                    My reports
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View className="h-8" />
      </ScrollView>

      <ReportCustomerModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        customerName={customerData.name}
        customerAddress={customerData.address}
      />

      <BlockCustomerModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        customerName={customerData.name}
        customerAddress={customerData.address}
      />
    </View>
  );
}
