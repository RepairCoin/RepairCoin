import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "../constants";

interface ShopProfileHeaderProps {
  name: string;
  verified?: boolean;
  logoUrl?: string;
  bannerUrl?: string;
}

export function ShopProfileHeader({
  name,
  verified,
  logoUrl,
  bannerUrl
}: ShopProfileHeaderProps) {
  return (
    <View className="mb-4">
      {/* Banner Image */}
      <View className="h-40 bg-zinc-800 relative">
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-zinc-800">
            <Ionicons name="image-outline" size={48} color="#52525b" />
          </View>
        )}
      </View>

      {/* Gradient overlay for better text contrast */}
      <View className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-950/80 to-transparent" />

      {/* Logo and Name Section */}
      <View className="px-4 -mt-8 relative z-10">
        <View className="flex-row items-end">
          {/* Logo/Avatar */}
          <View
            className="w-24 h-24 rounded-full items-center justify-center border-4 border-zinc-950 overflow-hidden"
            style={{ backgroundColor: logoUrl ? 'transparent' : PROFILE_COLORS.primary }}
          >
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="storefront" size={40} color="#000" />
            )}
          </View>

          {/* Name and Verified Badge */}
          <View className="flex-1 ml-3 pb-2">
            <Text className="text-white text-xl font-bold" numberOfLines={2}>
              {name || "Unknown Shop"}
            </Text>
            {verified && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="checkmark-circle" size={16} color={PROFILE_COLORS.success} />
                <Text className="text-green-500 text-sm ml-1">Verified Shop</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
