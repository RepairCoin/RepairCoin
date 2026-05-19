import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ShopInfoSectionProps {
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  shopEmail?: string;
  onCall: () => void;
  onEmail: () => void;
}

export function ShopInfoSection({
  shopName,
  shopAddress,
  shopPhone,
  shopEmail,
  onCall,
  onEmail,
}: ShopInfoSectionProps) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-4">
        <Text className="text-white text-lg font-semibold">
          Shop Information
        </Text>
      </View>

      {/* Shop Name */}
      {shopName && (
        <View className="flex-row items-center mb-3">
          <View className="bg-gray-800 rounded-full p-2 mr-3">
            <Ionicons name="storefront-outline" size={20} color="#FFCC00" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Shop Name</Text>
            <Text className="text-white text-base">{shopName}</Text>
          </View>
        </View>
      )}

      {/* Shop Address */}
      {shopAddress && (
        <View className="flex-row items-center mb-3">
          <View className="bg-gray-800 rounded-full p-2 mr-3">
            <Ionicons name="location-outline" size={20} color="#FFCC00" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Address</Text>
            <Text className="text-white text-base">{shopAddress}</Text>
          </View>
        </View>
      )}

      {/* Shop Phone */}
      {shopPhone && (
        <TouchableOpacity onPress={onCall} className="flex-row items-center mb-3">
          <View className="bg-gray-800 rounded-full p-2 mr-3">
            <Ionicons name="call-outline" size={20} color="#FFCC00" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Phone</Text>
            <Text className="text-[#FFCC00] text-base">{shopPhone}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      )}

      {/* Shop Email */}
      {shopEmail && (
        <TouchableOpacity onPress={onEmail} className="flex-row items-center mb-3">
          <View className="bg-gray-800 rounded-full p-2 mr-3">
            <Ionicons name="mail-outline" size={20} color="#FFCC00" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-sm">Email</Text>
            <Text className="text-[#FFCC00] text-base">{shopEmail}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  );
}
