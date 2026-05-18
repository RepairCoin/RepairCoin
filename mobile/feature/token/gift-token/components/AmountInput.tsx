import { View, Text, TextInput, TouchableOpacity } from "react-native";

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onMaxPress: () => void;
}

export default function AmountInput({
  value,
  onChangeText,
  onMaxPress,
}: AmountInputProps) {
  return (
    <View className="mb-4">
      <Text className="text-white text-sm font-medium mb-2">Amount (RCN)</Text>
      <View className="bg-zinc-900 rounded-xl flex-row items-center px-4">
        <Text className="text-[#FFCC00] text-lg font-bold">RCN</Text>
        <TextInput
          className="flex-1 text-white py-4 px-3"
          placeholder="0"
          placeholderTextColor="#6B7280"
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
        />
        <TouchableOpacity
          onPress={onMaxPress}
          className="bg-zinc-800 px-3 py-1.5 rounded-lg"
        >
          <Text className="text-[#FFCC00] text-sm font-medium">MAX</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
