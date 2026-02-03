// Libraries
import React from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  Linking,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

// Hooks
import { useAuthStore } from "@/shared/store/auth.store";
import { useShop } from "@/shared/hooks/shop/useShop";

// Constants
const COLORS = {
  primary: "#FFCC00",
  success: "#22C55E",
  error: "#EF4444",
  background: "#09090b",
  card: "#18181b",
  border: "#27272a",
};

export default function ShopAccountScreen() {
  const { account } = useAuthStore();
  const { useGetShopByWalletAddress } = useShop();

  const { data: shopData } = useGetShopByWalletAddress(account?.address || "");

  const getSubscriptionStatus = () => {
    if (shopData?.operational_status === "subscription_qualified") {
      return { label: "Active", color: COLORS.success, bgColor: "bg-green-500/20" };
    }
    return { label: "Inactive", color: COLORS.error, bgColor: "bg-red-500/20" };
  };

  const subscriptionStatus = getSubscriptionStatus();

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "elite":
        return "#A855F7";
      case "premium":
        return "#3B82F6";
      default:
        return COLORS.primary;
    }
  };

  const handleOpenWebsite = () => {
    if (shopData?.website) {
      const url = shopData.website.startsWith("http")
        ? shopData.website
        : `https://${shopData.website}`;
      Linking.openURL(url);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num?.toString() || "0";
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner Section */}
        <View className="relative">
          {/* Banner Image */}
          <View className="h-44 bg-zinc-800">
            {shopData?.bannerUrl ? (
              <Image
                source={{ uri: shopData.bannerUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Ionicons name="image-outline" size={48} color="#3f3f46" />
              </View>
            )}
          </View>

          {/* Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(9,9,11,0.8)", "rgba(9,9,11,1)"]}
            className="absolute bottom-0 left-0 right-0 h-24"
          />

          {/* Settings Button */}
          <TouchableOpacity
            onPress={() => router.push("/shop/settings")}
            className="absolute top-12 right-4 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Edit Profile Button */}
          <TouchableOpacity
            onPress={() => router.push("/shop/profile/edit-profile")}
            className="absolute top-12 right-16 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            <Feather name="edit-2" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Info Section */}
        <View className="px-4 -mt-16 relative z-10">
          <View className="flex-row items-end">
            {/* Logo */}
            <View
              className="w-28 h-28 rounded-full border-4 border-zinc-950 overflow-hidden"
              style={{ backgroundColor: shopData?.logoUrl ? "transparent" : COLORS.card }}
            >
              {shopData?.logoUrl ? (
                <Image
                  source={{ uri: shopData.logoUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-[#FFCC00]/20">
                  <Ionicons name="storefront" size={44} color={COLORS.primary} />
                </View>
              )}
            </View>

            {/* Name & Badges */}
            <View className="flex-1 ml-4 pb-2">
              <View className="flex-row items-center">
                <Text className="text-white text-xl font-bold flex-shrink" numberOfLines={1}>
                  {shopData?.name || "Shop"}
                </Text>
                {shopData?.verified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={COLORS.success}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>

              {/* Status Badges */}
              <View className="flex-row items-center mt-2 gap-2">
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${getTierColor(shopData?.rcg_tier || "")}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: getTierColor(shopData?.rcg_tier || "") }}
                  >
                    {shopData?.rcg_tier || "Standard"}
                  </Text>
                </View>
                <View className={`${subscriptionStatus.bgColor} px-2.5 py-1 rounded-full`}>
                  <Text style={{ color: subscriptionStatus.color }} className="text-xs font-semibold">
                    {subscriptionStatus.label}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        <View className="flex-row mx-4 mt-6 bg-zinc-900 rounded-2xl p-4">
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {formatNumber(shopData?.purchasedRcnBalance || 0)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">RCN Balance</Text>
          </View>
          <View className="w-px bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {formatNumber(shopData?.totalTokensIssued || 0)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">Issued</Text>
          </View>
          <View className="w-px bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {formatNumber(shopData?.totalRedemptions || 0)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">Redeemed</Text>
          </View>
          <View className="w-px bg-zinc-800" />
          <View className="flex-1 items-center">
            <Text className="text-white text-xl font-bold">
              {formatNumber(shopData?.rcg_balance || 0)}
            </Text>
            <Text className="text-zinc-500 text-xs mt-1">RCG</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row mx-4 mt-4 gap-3">
          <TouchableOpacity
            onPress={() => router.push("/shop/buy-token")}
            className="flex-1 bg-[#FFCC00] rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="wallet" size={18} color="#000" />
            <Text className="text-black font-semibold ml-2">Buy RCN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/shop/redeem-token")}
            className="flex-1 bg-zinc-800 rounded-xl py-3 flex-row items-center justify-center"
          >
            <Ionicons name="qr-code" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-2">Redeem</Text>
          </TouchableOpacity>
        </View>

        {/* Shop Details Section */}
        <View className="mx-4 mt-6 bg-zinc-900 rounded-2xl overflow-hidden">
          <Text className="text-zinc-500 text-xs font-semibold px-4 pt-4 pb-2">
            SHOP DETAILS
          </Text>

          {/* Email */}
          {shopData?.email && (
            <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Email</Text>
                <Text className="text-white text-sm mt-0.5">{shopData.email}</Text>
              </View>
            </View>
          )}

          {/* Phone */}
          {shopData?.phone && (
            <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="call-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Phone</Text>
                <Text className="text-white text-sm mt-0.5">{shopData.phone}</Text>
              </View>
            </View>
          )}

          {/* Address */}
          {shopData?.address && (
            <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Address</Text>
                <Text className="text-white text-sm mt-0.5" numberOfLines={2}>
                  {shopData.address}
                  {shopData.location?.city && `, ${shopData.location.city}`}
                </Text>
              </View>
            </View>
          )}

          {/* Website */}
          {shopData?.website && (
            <TouchableOpacity
              onPress={handleOpenWebsite}
              className="flex-row items-center px-4 py-3"
            >
              <View className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center">
                <Ionicons name="globe-outline" size={18} color={COLORS.primary} />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-zinc-500 text-xs">Website</Text>
                <Text className="text-[#FFCC00] text-sm mt-0.5">{shopData.website}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>

        {/* Social Links */}
        {(shopData?.facebook || shopData?.twitter || shopData?.instagram) && (
          <View className="mx-4 mt-4 bg-zinc-900 rounded-2xl overflow-hidden">
            <Text className="text-zinc-500 text-xs font-semibold px-4 pt-4 pb-2">
              SOCIAL MEDIA
            </Text>
            <View className="flex-row px-4 py-3 gap-3">
              {shopData?.facebook && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(shopData.facebook)}
                  className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center"
                >
                  <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                </TouchableOpacity>
              )}
              {shopData?.twitter && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(shopData.twitter)}
                  className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center"
                >
                  <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                </TouchableOpacity>
              )}
              {shopData?.instagram && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(shopData.instagram)}
                  className="w-12 h-12 rounded-full bg-zinc-800 items-center justify-center"
                >
                  <Ionicons name="logo-instagram" size={24} color="#E4405F" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
