import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ServiceBottomActionsProps {
  isActive: boolean;
  onViewShop: () => void;
  onBookNow: () => void;
}

export function ServiceBottomActions({
  isActive,
  onViewShop,
  onBookNow,
}: ServiceBottomActionsProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-gray-800 pb-8">
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={onViewShop}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl py-4 items-center flex-row justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="storefront-outline" size={20} color="#FFCC00" />
          <Text className="text-white text-lg font-bold ml-2">View Shop</Text>
        </TouchableOpacity>
        {isActive && (
          <TouchableOpacity
            onPress={onBookNow}
            className="flex-1 bg-[#FFCC00] rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-black text-lg font-bold">Book Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
