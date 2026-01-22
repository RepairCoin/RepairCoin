import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ChatHeaderProps = {
  name?: string;
  subtitle: string;
  onBack: () => void;
};

export default function ChatHeader({ name, subtitle, onBack }: ChatHeaderProps) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900">
      <Pressable
        onPress={onBack}
        className="w-10 h-10 items-center justify-center mr-2"
      >
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>

      <View className="w-10 h-10 rounded-full bg-[#FFCC00] items-center justify-center mr-3">
        <Text className="text-black font-bold">
          {name?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-white font-semibold">{name || "Conversation"}</Text>
        <Text className="text-zinc-400 text-xs">{subtitle}</Text>
      </View>

      <Pressable className="w-10 h-10 items-center justify-center">
        <Ionicons name="ellipsis-vertical" size={20} color="white" />
      </Pressable>
    </View>
  );
}
