import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "../constants";

interface ShopProfileHeaderProps {
  name: string;
  verified?: boolean;
}

export function ShopProfileHeader({ name, verified }: ShopProfileHeaderProps) {
  return (
    <View className="flex-row items-center px-4 pb-4">
      <View
        className="w-20 h-20 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: PROFILE_COLORS.primary }}
      >
        <Ionicons name="storefront" size={40} color="#000" />
      </View>
      <View className="flex-1">
        <Text className="text-white text-xl font-bold">
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
  );
}
