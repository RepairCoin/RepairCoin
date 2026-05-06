import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "../constants";
import { getTierColor, getTierDisplayName } from "../../utils";

interface CustomerProfileHeaderProps {
  name?: string;
  tier?: string;
  profileImageUrl?: string | null;
}

export function CustomerProfileHeader({
  name,
  tier,
  profileImageUrl,
}: CustomerProfileHeaderProps) {
  return (
    <View className="flex-row items-center px-4 pb-6">
      <View
        className="w-20 h-20 rounded-full items-center justify-center border-2 overflow-hidden"
        style={{
          backgroundColor: "#27272a",
          borderColor: PROFILE_COLORS.primary
        }}
      >
        {profileImageUrl ? (
          <Image
            source={{ uri: profileImageUrl }}
            className="w-full h-full rounded-full"
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="person" size={40} color={PROFILE_COLORS.primary} />
        )}
      </View>
      <View className="flex-1 ml-4">
        <Text className="text-white text-xl font-bold">
          {name || "Anonymous User"}
        </Text>
        <View className="flex-row items-center mt-1">
          <MaterialCommunityIcons
            name="shield-star"
            size={16}
            color={getTierColor(tier)}
          />
          <Text className="text-gray-400 text-sm ml-1">
            {getTierDisplayName(tier)} Member
          </Text>
        </View>
      </View>
    </View>
  );
}
