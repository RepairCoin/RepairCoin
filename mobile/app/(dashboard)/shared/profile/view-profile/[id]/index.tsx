import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams } from "expo-router";
import { useShop } from "@/hooks/shop/useShop";
import { customerApi } from "@/services/customer.services";
import { CustomerData } from "@/interfaces/customer.interface";
import { AppHeader } from "@/components/ui/AppHeader";
import ViewShopProfile from "./shop";

type ProfileType = "shop" | "customer" | "unknown";

// Helper to check if string is a valid Ethereum address
const isEthereumAddress = (str: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(str);
};

export default function ViewProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetShopById } = useShop();

  // Determine if this is likely a shop ID (numeric) or wallet address
  const isWalletAddress = id ? isEthereumAddress(id) : false;

  // Only fetch shop if it's not a wallet address (shop IDs are usually numeric)
  const {
    data: shopData,
    isLoading: shopLoading,
    error: shopError,
  } = useGetShopById(!isWalletAddress && id ? id : "");

  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType>("unknown");

  // Fetch profile based on ID type
  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // If it's a wallet address, fetch customer directly
      if (isWalletAddress) {
        setCustomerLoading(true);
        try {
          const response = await customerApi.getCustomerByWalletAddress(id);
          if (response?.data?.customer) {
            setCustomerData(response.data.customer);
            setProfileType("customer");
          } else {
            setProfileType("unknown");
          }
        } catch (error) {
          console.log("Customer not found:", error);
          setProfileType("unknown");
        } finally {
          setCustomerLoading(false);
        }
        return;
      }

      // If shop data is loaded and has data, it's a shop
      if (shopData && !shopError) {
        setProfileType("shop");
        return;
      }

      // If shop loading is done and no shop data, mark as unknown
      if (!shopLoading && !shopData) {
        setProfileType("unknown");
      }
    };

    fetchProfile();
  }, [id, shopData, shopLoading, shopError, isWalletAddress]);

  const isLoading = shopLoading || customerLoading;

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmail = (email?: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading profile...</Text>
      </View>
    );
  }

  if (profileType === "unknown" || (!shopData && !customerData)) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={goBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Profile not found</Text>
          <Text className="text-gray-400 text-sm mt-2">
            The profile you're looking for doesn't exist
          </Text>
        </View>
      </View>
    );
  }

  // Shop Profile View
  if (profileType === "shop" && shopData) {
    return (
      <ViewShopProfile id={id} />
    );
  }

  // Customer Profile View
  if (profileType === "customer" && customerData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Customer Profile" />

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Spacer */}
          <View className="h-4" />

          {/* Customer Avatar & Name */}
          <View className="items-center px-4 pb-6">
            <View className="bg-zinc-800 w-24 h-24 rounded-full items-center justify-center mb-4 border-2 border-[#FFCC00]">
              <Ionicons name="person" size={48} color="#FFCC00" />
            </View>
            <Text className="text-white text-2xl font-bold text-center">
              {customerData.name || "Anonymous User"}
            </Text>
            <View className="flex-row items-center mt-2">
              <MaterialCommunityIcons
                name="shield-star"
                size={18}
                color={
                  customerData.tier === "gold"
                    ? "#FFD700"
                    : customerData.tier === "silver"
                      ? "#C0C0C0"
                      : "#CD7F32"
                }
              />
              <Text className="text-gray-400 text-sm ml-1 capitalize">
                {customerData.tier || "Bronze"} Member
              </Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row justify-around bg-zinc-900 rounded-2xl p-4 mx-4 mb-6">
            <View className="items-center">
              <Text className="text-[#FFCC00] text-xl font-bold">
                {customerData.lifetimeEarnings || 0}
              </Text>
              <Text className="text-gray-400 text-xs">RCN Earned</Text>
            </View>
            <View className="w-px bg-zinc-700" />
            <View className="items-center">
              <Text className="text-[#FFCC00] text-xl font-bold">
                {customerData.totalRedemptions || 0}
              </Text>
              <Text className="text-gray-400 text-xs">Redeemed</Text>
            </View>
            <View className="w-px bg-zinc-700" />
            <View className="items-center">
              <Text className="text-[#FFCC00] text-xl font-bold">
                {customerData.totalRepairs || 0}
              </Text>
              <Text className="text-gray-400 text-xs">Repairs</Text>
            </View>
          </View>

          {/* Contact Information */}
          <View className="px-4 mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Contact Information
            </Text>

            {/* Email */}
            {customerData.email && (
              <TouchableOpacity
                onPress={() => handleEmail(customerData.email)}
                className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
              >
                <View className="bg-zinc-800 rounded-full p-2 mr-3">
                  <Ionicons name="mail-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Email</Text>
                  <Text className="text-[#FFCC00] text-base">
                    {customerData.email}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            {/* Phone */}
            {customerData.phone && (
              <TouchableOpacity
                onPress={() => handleCall(customerData.phone)}
                className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
              >
                <View className="bg-zinc-800 rounded-full p-2 mr-3">
                  <Ionicons name="call-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Phone</Text>
                  <Text className="text-[#FFCC00] text-base">
                    {customerData.phone}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            {/* Address */}
            {customerData.address && (
              <View className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3">
                <View className="bg-zinc-800 rounded-full p-2 mr-3">
                  <Ionicons name="location-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Address</Text>
                  <Text className="text-white text-base">
                    {customerData.address}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Customer Details */}
          <View className="px-4 mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Account Details
            </Text>

            <View className="bg-zinc-900 rounded-xl p-4">
              <View className="flex-row justify-between py-3 border-b border-zinc-800">
                <Text className="text-gray-400">Member Since</Text>
                <Text className="text-white">
                  {formatDate(customerData.joinDate)}
                </Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-zinc-800">
                <Text className="text-gray-400">Referral Code</Text>
                <Text className="text-[#FFCC00]">
                  {customerData.referralCode || "N/A"}
                </Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-zinc-800">
                <Text className="text-gray-400">Referrals</Text>
                <Text className="text-white">
                  {customerData.referralCount || 0}
                </Text>
              </View>
              <View className="flex-row justify-between py-3">
                <Text className="text-gray-400">Status</Text>
                <View className="flex-row items-center">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${customerData.isActive ? "bg-green-500" : "bg-gray-500"}`}
                  />
                  <Text
                    className={
                      customerData.isActive ? "text-green-500" : "text-gray-500"
                    }
                  >
                    {customerData.isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Earnings Summary */}
          <View className="px-4 mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Earnings Summary
            </Text>

            <View className="bg-zinc-900 rounded-xl p-4">
              <View className="flex-row justify-between py-3 border-b border-zinc-800">
                <Text className="text-gray-400">Daily Earnings</Text>
                <Text className="text-[#FFCC00]">
                  {customerData.dailyEarnings || 0} RCN
                </Text>
              </View>
              <View className="flex-row justify-between py-3 border-b border-zinc-800">
                <Text className="text-gray-400">Monthly Earnings</Text>
                <Text className="text-[#FFCC00]">
                  {customerData.monthlyEarnings || 0} RCN
                </Text>
              </View>
              <View className="flex-row justify-between py-3">
                <Text className="text-gray-400">Lifetime Earnings</Text>
                <Text className="text-[#FFCC00]">
                  {customerData.lifetimeEarnings || 0} RCN
                </Text>
              </View>
            </View>
          </View>

          {/* Bottom Spacer */}
          <View className="h-8" />
        </ScrollView>
      </View>
    );
  }

  return null;
}
