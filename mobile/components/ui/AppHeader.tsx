import { TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { ReactNode } from "react";

interface AppHeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightElement?: ReactNode;
}

export function AppHeader({
  title,
  showBackButton = true,
  onBackPress,
  rightElement,
}: AppHeaderProps) {
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      goBack();
    }
  };

  return (
    <View className="pt-14 px-4 py-6 bg-zinc-950/90">
      <View className="flex-row items-center justify-center relative">
        {showBackButton && (
          <TouchableOpacity
            onPress={handleBackPress}
            className="absolute left-0 bg-black/50 rounded-full p-2"
          >
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        )}
        <Text className="text-white text-xl font-bold">{title}</Text>
        {rightElement && (
          <View className="absolute right-0">{rightElement}</View>
        )}
      </View>
    </View>
  );
}
