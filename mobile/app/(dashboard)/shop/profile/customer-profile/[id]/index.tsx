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
import { customerApi } from "@/services/customer.services";
import { CustomerData, CustomerResponse } from "@/interfaces/customer.interface";
import { AppHeader } from "@/components/ui/AppHeader";

export default function ViewCustomerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerProfile = async () => {
      if (!id) {
        setError("No customer ID provided");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response: CustomerResponse = await customerApi.getCustomerByWalletAddress(id);
        if (response?.data?.customer) {
          setCustomerData(response.data.customer);
        } else {
          setError("Customer not found");
        }
      } catch (err) {
        console.log("Customer not found:", err);
        setError("Customer not found");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerProfile();
  }, [id]);

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

  if (error || !customerData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={goBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Customer not found</Text>
          <Text className="text-gray-400 text-sm mt-2">
            The customer you're looking for doesn't exist
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <AppHeader title="Customer Profile" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Spacer */}
        <View className="h-4" />

        {/* Profile Header */}
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

        {/* Bottom Spacer */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
