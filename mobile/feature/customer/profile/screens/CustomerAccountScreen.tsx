import React from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { useCustomer } from "../hooks/useCustomer";
import TierBadge from "@/shared/components/ui/TierBadge";
import StatsRow from "@/shared/components/ui/StatsRow";
import MenuRow from "@/shared/components/ui/MenuRow";
import GradientHeader from "@/shared/components/ui/GradientHeader";

export default function CustomerAccountScreen() {
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();

  const { data: customerData } = useGetCustomerByWalletAddress(
    account?.address
  );

  const customer = customerData?.customer;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toFixed(0) || "0";
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const memberSince = customer?.joinDate
    ? new Date(customer.joinDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View className="flex-1 bg-zinc-950">
      <GradientHeader
        title="My Account"
        right={
          <TouchableOpacity
            onPress={() => router.push("/customer/settings")}
            className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={22} color="#000" />
          </TouchableOpacity>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info Section */}
        <View className="px-4 pt-6">
          <View className="flex-row items-center">
            {/* Avatar with tier-gold ring */}
            <TouchableOpacity
              onPress={() => router.push("/customer/profile/edit-profile")}
              activeOpacity={0.8}
            >
              <View
                className="w-24 h-24 rounded-full overflow-hidden items-center justify-center bg-zinc-800"
                style={{ borderWidth: 3, borderColor: "#FFCC00" }}
              >
                {customer?.profileImageUrl ? (
                  <Image
                    source={{ uri: customer.profileImageUrl }}
                    className="w-full h-full rounded-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Text className="text-3xl font-bold text-[#FFCC00]">
                    {getInitials(customer?.name || "User")}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Name, Tier Badge & Member Since */}
            <View className="flex-1 ml-4">
              <Text
                className="text-white text-2xl font-bold"
                numberOfLines={1}
              >
                {customer?.name || "User"}
              </Text>

              <TouchableOpacity
                onPress={() => router.push("/customer/tier-info")}
                activeOpacity={0.8}
                className="mt-2 self-start"
              >
                <TierBadge tier={customer?.tier} size="md" variant="soft" />
              </TouchableOpacity>

              {memberSince && (
                <Text className="text-zinc-400 text-xs mt-2">
                  Member Since: {memberSince}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Stats Section (V2) */}
        <View className="mt-6">
          <StatsRow
            items={[
              {
                value: formatNumber(customer?.currentRcnBalance || 0),
                label: "Rewards Balance",
              },
              {
                value: customer?.totalRepairs || 0,
                label: "Successful Bookings",
              },
              {
                value: customer?.referralCount || 0,
                label: "Referred Friends",
              },
              // TODO(wire-later): backend has no reviewsSubmitted count yet.
              { value: 0, label: "Reviews Submitted" },
            ]}
          />
        </View>

        {/* Menu Section (V2) */}
        <View className="mx-4 mt-6 bg-zinc-900 rounded-2xl overflow-hidden">
          <MenuRow
            icon="trophy-outline"
            label="Tier Progress"
            onPress={() => router.push("/customer/tier-info")}
          />
          <MenuRow
            icon="qr-code-outline"
            label="My Qr Code"
            onPress={() => router.push("/customer/qrcode")}
          />
          <MenuRow
            icon="person-add-outline"
            label="Refer a Friend"
            onPress={() => router.push("/customer/referral")}
          />

          {/*<MenuRow
            icon="storefront-outline"
            label="Refer a Shop"
            // TODO(wire-later): dedicated refer-a-shop flow; reuse referral for now.
            onPress={() => router.push("/customer/referral")}
          />
          <MenuRow
            icon="help-circle-outline"
            label="Support"
            isLast
            // TODO(wire-later): dedicated support screen; route to messages for now.
            onPress={() => router.push("/customer/messages")}
          /> */}
        </View>

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
