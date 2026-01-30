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
      <View className="flex-row items-center justify-between">
        <View className="w-12">
          {showBackButton && (
            <TouchableOpacity
              onPress={handleBackPress}
              className="bg-black/50 rounded-full p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" color="white" size={24} />
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-white text-xl font-bold flex-1 text-center">{title}</Text>
        <View className="w-12 items-end">
          {rightElement}
        </View>
      </View>
    </View>
  );
}
