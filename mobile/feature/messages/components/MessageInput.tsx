import { View, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type MessageInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isSending: boolean;
};

export default function MessageInput({
  value,
  onChangeText,
  onSend,
  isSending,
}: MessageInputProps) {
  const canSend = value.trim() && !isSending;

  return (
    <View className="px-4 py-4 border-t border-zinc-800 bg-zinc-900">
      <View className="flex-row items-center">
        <View className="flex-1 h-12 bg-zinc-800 rounded-full px-4 mr-2 border border-zinc-700 justify-center">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="Type a message..."
            placeholderTextColor="#71717A"
            className="text-white text-sm"
            editable={!isSending}
          />
        </View>

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          className={`w-12 h-12 rounded-full items-center justify-center ${
            canSend ? "bg-[#FFCC00]" : "bg-zinc-800"
          }`}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="send" size={20} color={canSend ? "#000" : "#71717A"} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
