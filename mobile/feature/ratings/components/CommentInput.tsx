import { View, Text, TextInput } from "react-native";
import { MAX_COMMENT_LENGTH } from "../constants";

interface CommentInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export default function CommentInput({ value, onChangeText }: CommentInputProps) {
  return (
    <View className="mb-6">
      <Text className="text-white text-base font-medium mb-2">
        Share your thoughts (optional)
      </Text>
      <TextInput
        className="bg-zinc-900 rounded-xl p-4 text-white text-base min-h-[120px]"
        placeholder="Tell others about your experience..."
        placeholderTextColor="#6B7280"
        multiline
        textAlignVertical="top"
        value={value}
        onChangeText={onChangeText}
        maxLength={MAX_COMMENT_LENGTH}
      />
      <Text className="text-gray-500 text-sm text-right mt-2">
        {value.length}/{MAX_COMMENT_LENGTH}
      </Text>
    </View>
  );
}
