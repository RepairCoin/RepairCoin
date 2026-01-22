import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ValidationResult } from "../types";

interface ValidationMessageProps {
  validationResult: ValidationResult | null;
  error: string | null;
}

export default function ValidationMessage({
  validationResult,
  error,
}: ValidationMessageProps) {
  if (validationResult?.valid) {
    return (
      <View className="bg-green-500/20 rounded-xl p-3 mb-4 flex-row items-center">
        <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
        <Text className="text-green-400 ml-2 flex-1">
          {validationResult.recipientExists
            ? "Recipient verified"
            : "New recipient - will be registered automatically"}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-red-500/20 rounded-xl p-3 mb-4 flex-row items-center">
        <Ionicons name="alert-circle" size={20} color="#EF4444" />
        <Text className="text-red-400 ml-2 flex-1">{error}</Text>
      </View>
    );
  }

  return null;
}
