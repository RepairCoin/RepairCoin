import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";

interface MarketingEmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** No shared EmptyState primitive exists yet — kept local per plan rather than adding one. */
export function MarketingEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: MarketingEmptyStateProps) {
  return (
    <View className="items-center justify-center py-16 px-8">
      <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center mb-4">
        <Ionicons name={icon} size={32} color="#4B5563" />
      </View>
      <Text className="text-white text-lg font-semibold mb-2 text-center">{title}</Text>
      {description && (
        <Text className="text-[#666] text-sm text-center mb-6">{description}</Text>
      )}
      {actionLabel && onAction && <PrimaryButton title={actionLabel} onPress={onAction} />}
    </View>
  );
}
