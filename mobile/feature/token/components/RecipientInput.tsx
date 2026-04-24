import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface RecipientInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onQRPress: () => void;
}

export default function RecipientInput({
  value,
  onChangeText,
  onQRPress,
}: RecipientInputProps) {
  return (
    <View className="mb-4">
      <Text className="text-white text-sm font-medium mb-2">
        Recipient Wallet Address
      </Text>
      <View className="bg-zinc-900 rounded-xl flex-row items-center px-4">
        <Ionicons name="wallet-outline" size={20} color="#9CA3AF" />
        <TextInput
          className="flex-1 text-white py-4 px-3"
          placeholder="0x..."
          placeholderTextColor="#6B7280"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onQRPress}>
          <Ionicons name="qr-code-outline" size={24} color="#FFCC00" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
