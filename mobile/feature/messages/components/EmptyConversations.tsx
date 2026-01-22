import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function EmptyConversations() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="chatbubbles-outline" size={64} color="#666" />
      <Text className="text-zinc-400 text-lg mt-4">No messages yet</Text>
      <Text className="text-zinc-600 text-sm mt-2 text-center px-8">
        When you start a conversation with a shop, it will appear here
      </Text>
    </View>
  );
}
