import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function GiftHeader() {
  return (
    <View className="items-center my-6">
      <View className="bg-[#FFCC00] rounded-full p-4">
        <MaterialIcons name="card-giftcard" size={48} color="#000" />
      </View>
      <Text className="text-white text-lg font-semibold mt-3">
        Send RCN to a friend
      </Text>
      <Text className="text-gray-400 text-sm text-center mt-1">
        Gift your tokens to another RepairCoin user
      </Text>
    </View>
  );
}
