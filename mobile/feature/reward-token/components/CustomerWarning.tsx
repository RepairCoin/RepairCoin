import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface CustomerWarningProps {
  type: "not-found" | "self-reward";
}

export default function CustomerWarning({ type }: CustomerWarningProps) {
  if (type === "not-found") {
    return (
      <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
        <View className="flex-row items-center">
          <MaterialIcons name="error" size={20} color="#EF4444" />
          <Text className="text-red-400 font-semibold ml-2">
            Customer Not Registered
          </Text>
        </View>
        <Text className="text-red-300/70 text-xs mt-1">
          This wallet address is not registered. Customer must register
          before receiving rewards.
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
      <View className="flex-row items-center">
        <MaterialIcons name="warning" size={20} color="#F59E0B" />
        <Text className="text-yellow-400 font-semibold ml-2">
          Cannot Issue to Your Own Wallet
        </Text>
      </View>
      <Text className="text-yellow-300/70 text-xs mt-1">
        You cannot issue rewards to your own wallet address.
      </Text>
    </View>
  );
}
