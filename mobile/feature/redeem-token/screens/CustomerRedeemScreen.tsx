import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { useCustomerRedeem } from "../hooks";
import {
  BalanceCard,
  PendingRequests,
  QuickActions,
  HowToRedeemModal,
  LoadingOverlay,
} from "../components";

export default function CustomerRedeemScreen() {
  const {
    refreshing,
    actionLoading,
    showHowToRedeem,
    setShowHowToRedeem,
    customerData,
    isLoadingCustomer,
    customerError,
    refetchCustomer,
    totalBalance,
    totalRedeemed,
    pendingSessions,
    isLoadingSessions,
    onRefresh,
    handleAccept,
    handleReject,
  } = useCustomerRedeem();

  if (isLoadingCustomer) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Redeem RCN" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FFCC00" />
          <Text className="text-gray-400 mt-4">Loading...</Text>
        </View>
      </View>
    );
  }

  if (customerError) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Redeem RCN" />
        <View className="flex-1 justify-center items-center">
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text className="text-red-400 text-lg mt-4">Failed to load data</Text>
          <Pressable
            onPress={() => refetchCustomer()}
            className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
          >
            <Text className="text-black font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader
        title="Redeem RCN"
        rightElement={
          <Pressable onPress={() => setShowHowToRedeem(true)} className="p-2">
            <Ionicons name="help-circle-outline" size={24} color="white" />
          </Pressable>
        }
      />

      <HowToRedeemModal
        visible={showHowToRedeem}
        onClose={() => setShowHowToRedeem(false)}
      />

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      >
        <BalanceCard totalBalance={totalBalance} totalRedeemed={totalRedeemed} />

        <PendingRequests
          pendingSessions={pendingSessions}
          isLoading={isLoadingSessions}
          actionLoading={actionLoading}
          onAccept={handleAccept}
          onReject={handleReject}
        />

        <QuickActions />
      </ScrollView>

      <LoadingOverlay visible={actionLoading} />
    </View>
  );
};