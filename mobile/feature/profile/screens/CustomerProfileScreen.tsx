import { View, ScrollView } from "react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import {
  ProfileLoadingState,
  ProfileErrorState,
  CustomerProfileHeader,
  CustomerStats,
  CustomerContactInfo
} from "../components";
import { useCustomerProfileScreen } from "../hooks/ui";
import { useLocalSearchParams } from "expo-router";

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    customerData,
    isLoading,
    error,
    goBack
  } = useCustomerProfileScreen(id);

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

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
