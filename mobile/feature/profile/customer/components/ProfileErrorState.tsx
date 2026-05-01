import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";

interface ProfileErrorStateProps {
  title: string;
  message: string;
  onBack?: () => void;
}

export function ProfileErrorState({
  title,
  message,
  onBack
}: ProfileErrorStateProps) {
  return (
    <View className="flex-1 bg-zinc-950">
      {onBack && (
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={onBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
      )}
      <View className="flex-1 items-center justify-center">
        <Feather name="alert-circle" size={48} color="#ef4444" />
        <Text className="text-white text-lg mt-4">{title}</Text>
        <Text className="text-gray-400 text-sm mt-2">{message}</Text>
      </View>
    </View>
  );
}
