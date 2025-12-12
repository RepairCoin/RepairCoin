import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface DetailsTabProps {
  shopData: any;
  handleCall: (phone?: string) => void;
  handleEmail: (email?: string) => void;
  handleWebsite: (website?: string) => void;
  handleSocial: (url?: string, platform?: string) => void;
  formatDate: (dateString?: string) => string;
}

export default function DetailsTab({
  shopData,
  handleCall,
  handleEmail,
  handleWebsite,
  handleSocial,
  formatDate,
}: DetailsTabProps) {
  return (
    <React.Fragment>
      {/* Contact Information */}
      <View className="px-4 mb-6">
        <Text className="text-white text-lg font-semibold mb-4">
          Contact Information
        </Text>

        {/* Address */}
        {shopData?.address && (
          <View className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3">
            <View className="bg-zinc-800 rounded-full p-2 mr-3">
              <Ionicons name="location-outline" size={20} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Address</Text>
              <Text className="text-white text-base">{shopData.address}</Text>
            </View>
          </View>
        )}

        {/* Phone */}
        {shopData?.phone && (
          <TouchableOpacity
            onPress={() => handleCall(shopData.phone)}
            className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
          >
            <View className="bg-zinc-800 rounded-full p-2 mr-3">
              <Ionicons name="call-outline" size={20} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Phone</Text>
              <Text className="text-[#FFCC00] text-base">{shopData.phone}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {/* Email */}
        {shopData?.email && (
          <TouchableOpacity
            onPress={() => handleEmail(shopData.email)}
            className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
          >
            <View className="bg-zinc-800 rounded-full p-2 mr-3">
              <Ionicons name="mail-outline" size={20} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Email</Text>
              <Text className="text-[#FFCC00] text-base">{shopData.email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}

        {/* Website */}
        {shopData?.website && (
          <TouchableOpacity
            onPress={() => handleWebsite(shopData.website)}
            className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
          >
            <View className="bg-zinc-800 rounded-full p-2 mr-3">
              <Ionicons name="globe-outline" size={20} color="#FFCC00" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Website</Text>
              <Text className="text-[#FFCC00] text-base">
                {shopData.website}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Social Media */}
      {(shopData?.facebook || shopData?.twitter || shopData?.instagram) && (
        <View className="px-4 mb-6">
          <Text className="text-white text-lg font-semibold mb-4">
            Social Media
          </Text>
          <View className="flex-row gap-3">
            {shopData?.facebook && (
              <TouchableOpacity
                onPress={() => handleSocial(shopData.facebook, "facebook")}
                className="flex-1 bg-zinc-900 rounded-xl p-4 items-center"
              >
                <Ionicons name="logo-facebook" size={28} color="#1877F2" />
                <Text className="text-gray-400 text-xs mt-2">Facebook</Text>
              </TouchableOpacity>
            )}
            {shopData?.twitter && (
              <TouchableOpacity
                onPress={() => handleSocial(shopData.twitter, "twitter")}
                className="flex-1 bg-zinc-900 rounded-xl p-4 items-center"
              >
                <Ionicons name="logo-twitter" size={28} color="#1DA1F2" />
                <Text className="text-gray-400 text-xs mt-2">Twitter</Text>
              </TouchableOpacity>
            )}
            {shopData?.instagram && (
              <TouchableOpacity
                onPress={() => handleSocial(shopData.instagram, "instagram")}
                className="flex-1 bg-zinc-900 rounded-xl p-4 items-center"
              >
                <Ionicons name="logo-instagram" size={28} color="#E4405F" />
                <Text className="text-gray-400 text-xs mt-2">Instagram</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Shop Details */}
      <View className="px-4 mb-6">
        <Text className="text-white text-lg font-semibold mb-4">
          Shop Details
        </Text>

        <View className="bg-zinc-900 rounded-xl p-4">
          <View className="flex-row justify-between py-3 border-b border-zinc-800">
            <Text className="text-gray-400">Member Since</Text>
            <Text className="text-white">{formatDate(shopData?.joinDate)}</Text>
          </View>
          <View className="flex-row justify-between py-3 border-b border-zinc-800">
            <Text className="text-gray-400">Status</Text>
            <View className="flex-row items-center">
              <View
                className={`w-2 h-2 rounded-full mr-2 ${shopData?.active ? "bg-green-500" : "bg-gray-500"}`}
              />
              <Text
                className={
                  shopData?.active ? "text-green-500" : "text-gray-500"
                }
              >
                {shopData?.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
          <View className="flex-row justify-between py-3">
            <Text className="text-gray-400">Cross-Shop Redemption</Text>
            <Text
              className={
                shopData?.crossShopEnabled ? "text-green-500" : "text-gray-500"
              }
            >
              {shopData?.crossShopEnabled ? "Enabled" : "Disabled"}
            </Text>
          </View>
        </View>
      </View>
    </React.Fragment>
  );
}
