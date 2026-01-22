import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function EmptyChat() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="chatbubble-outline" size={48} color="#666" />
      <Text className="text-zinc-400 mt-4">No messages yet</Text>
      <Text className="text-zinc-600 text-sm mt-1">Start the conversation!</Text>
    </View>
  );
}
