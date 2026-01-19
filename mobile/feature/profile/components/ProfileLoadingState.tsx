import { View, Text, ActivityIndicator } from "react-native";
import { PROFILE_COLORS } from "../constants";

interface ProfileLoadingStateProps {
  message?: string;
}

export function ProfileLoadingState({
  message = "Loading profile..."
}: ProfileLoadingStateProps) {
  return (
    <View className="flex-1 bg-zinc-950 items-center justify-center">
      <ActivityIndicator size="large" color={PROFILE_COLORS.primary} />
      <Text className="text-gray-400 mt-4">{message}</Text>
    </View>
  );
}
