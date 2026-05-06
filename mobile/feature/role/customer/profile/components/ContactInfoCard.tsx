import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PROFILE_COLORS } from "../constants";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface ContactInfoCardProps {
  label: string;
  value: string;
  iconName: IconName;
  onPress?: () => void;
  actionIcon?: IconName;
  truncate?: boolean;
}

export function ContactInfoCard({
  label,
  value,
  iconName,
  onPress,
  actionIcon = "chevron-forward",
  truncate = false
}: ContactInfoCardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      className="flex-row items-center bg-zinc-900 rounded-xl p-4 mb-3"
    >
      <View className="bg-zinc-800 rounded-full p-2 mr-3">
        <Ionicons name={iconName} size={20} color={PROFILE_COLORS.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-gray-500 text-xs">{label}</Text>
        <Text
          style={{ color: PROFILE_COLORS.primary }}
          className={`text-base ${truncate ? "font-mono text-sm" : ""}`}
          numberOfLines={truncate ? 1 : undefined}
        >
          {value}
        </Text>
      </View>
      {onPress && (
        <Ionicons name={actionIcon} size={20} color="#666" />
      )}
    </Container>
  );
}
