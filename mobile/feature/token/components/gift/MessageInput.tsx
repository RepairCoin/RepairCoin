import { View, Text, TextInput } from "react-native";
import { MESSAGE_MAX_LENGTH } from "../constants";

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export default function MessageInput({ value, onChangeText }: MessageInputProps) {
  return (
    <View className="mb-4">
      <Text className="text-white text-sm font-medium mb-2">
        Message (Optional)
      </Text>
      <View className="bg-zinc-900 rounded-xl px-4">
        <TextInput
          className="text-white py-4"
          placeholder="Add a message..."
          placeholderTextColor="#6B7280"
          value={value}
          onChangeText={onChangeText}
          multiline
          numberOfLines={2}
          maxLength={MESSAGE_MAX_LENGTH}
        />
      </View>
      <Text className="text-gray-500 text-xs mt-1 text-right">
        {value.length}/{MESSAGE_MAX_LENGTH}
      </Text>
    </View>
  );
}
