import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams } from "expo-router";
import { useShop } from "@/hooks/shop/useShop";
import { customerApi } from "@/services/customer.services";
import { CustomerData, CustomerResponse } from "@/interfaces/customer.interface";
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
  const [activeTab, setActiveTab] = useState<"detail" | "message">("detail");

  // Fetch profile based on ID type
  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;

      // If it's a wallet address, fetch customer directly
      if (isWalletAddress) {
        setCustomerLoading(true);
        try {
          const response: CustomerResponse= await customerApi.getCustomerByWalletAddress(id);
          console.log("responseresponse: ", response)
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

  const handleCopy = async (text?: string, label?: string) => {
    if (text) {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied", `${label || "Text"} copied to clipboard`);
    }
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

  console.log("Profile type:", profileType);
  console.log("Shop data:", shopData);
  console.log("Customer data:", customerData);

  // Customer Profile View
  if (profileType === "customer" && customerData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Customer Profile" />

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Spacer */}
          <View className="h-4" />

          {/* Profile Header - Instagram Style */}
          <View className="flex-row items-center px-4 pb-6">
            <View className="bg-zinc-800 w-20 h-20 rounded-full items-center justify-center border-2 border-[#FFCC00]">
              <Ionicons name="person" size={40} color="#FFCC00" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-white text-xl font-bold">
                {customerData.name || "Anonymous User"}
              </Text>
              <View className="flex-row items-center mt-1">
                <MaterialCommunityIcons
                  name="shield-star"
                  size={16}
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
          </View>

          {/* Tab Buttons */}
          {/* <View className="flex-row mx-4 mb-6 bg-zinc-900 rounded-xl p-1">
            <TouchableOpacity
              onPress={() => setActiveTab("detail")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "detail" ? "bg-[#FFCC00]" : ""}`}
            >
              <Text
                className={`text-center font-semibold ${activeTab === "detail" ? "text-black" : "text-gray-400"}`}
              >
                Detail
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("message")}
              className={`flex-1 py-3 rounded-lg ${activeTab === "message" ? "bg-[#FFCC00]" : ""}`}
            >
              <Text
                className={`text-center font-semibold ${activeTab === "message" ? "text-black" : "text-gray-400"}`}
              >
                Message
              </Text>
            </TouchableOpacity>
          </View> */}

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
              <Text className="text-gray-400 text-xs">Services</Text>
            </View>
          </View>

          {/* Tab Content */}
          {activeTab === "detail" && (
            <>
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

            {/* Wallet Address */}
            {customerData.address && (
              <TouchableOpacity
                onPress={() => handleCopy(customerData.address, "Wallet address")}
                className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
              >
                <View className="bg-zinc-800 rounded-full p-2 mr-3">
                  <Ionicons name="wallet-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Wallet Address</Text>
                  <Text className="text-[#FFCC00] text-sm font-mono" numberOfLines={1}>
                    {customerData.address}
                  </Text>
                </View>
                <Ionicons name="copy-outline" size={20} color="#666" />
              </TouchableOpacity>
            )}
            </View>
            </>
          )}

          {/* Message Tab */}
          {activeTab === "message" && (
            <View className="px-4 flex-1">
              <View className="bg-zinc-900 rounded-xl p-6 items-center justify-center">
                <View className="bg-zinc-800 rounded-full p-4 mb-4">
                  <Ionicons name="chatbubbles-outline" size={32} color="#FFCC00" />
                </View>
                <Text className="text-white text-lg font-semibold mb-2">
                  Start a Conversation
                </Text>
                <Text className="text-gray-400 text-sm text-center mb-4">
                  Send a message to {customerData.name || "this customer"}
                </Text>
                <TouchableOpacity
                  className="bg-[#FFCC00] px-6 py-3 rounded-xl"
                  onPress={() => {
                    if (customerData.phone) {
                      Linking.openURL(`sms:${customerData.phone}`);
                    } else if (customerData.email) {
                      Linking.openURL(`mailto:${customerData.email}`);
                    }
                  }}
                >
                  <Text className="text-black font-semibold">Send Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom Spacer */}
          <View className="h-8" />
        </ScrollView>
      </View>
    );
  }

  return null;
}
