import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "@/shared/hooks/useHaptics";

export type CalloutTone = "info" | "warning" | "success" | "danger";

interface ToneStyle {
  container: string;
  accent: string;
  button: string;
}

const TONES: Record<CalloutTone, ToneStyle> = {
  info: {
    container: "bg-blue-500/10 border-blue-500/40",
    accent: "#60A5FA",
    button: "bg-blue-600",
  },
  warning: {
    container: "bg-orange-500/15 border-orange-500/40",
    accent: "#f97316",
    button: "bg-orange-600",
  },
  success: {
    container: "bg-green-500/10 border-green-500/40",
    accent: "#4CAF50",
    button: "bg-green-600",
  },
  danger: {
    container: "bg-red-500/10 border-red-500/40",
    accent: "#EF4444",
    button: "bg-red-600",
  },
};

interface CalloutCardProps {
  tone?: CalloutTone;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
    loading?: boolean;
  };
  className?: string;
}

/**
 * Generic tinted callout: icon + title + description with an optional
 * action button. Used for inline notices (pending cancellation, free
 * trial offer, etc.) instead of ad-hoc banner markup per screen.
 */
export default function CalloutCard({
  tone = "info",
  icon,
  title,
  description,
  action,
  className = "",
}: CalloutCardProps) {
  const haptics = useHaptics();
  const t = TONES[tone];

  return (
    <View className={`border rounded-2xl p-4 ${t.container} ${className}`}>
      <View className="flex-row items-center gap-2 mb-1">
        {icon && <Ionicons name={icon} size={18} color={t.accent} />}
        <Text
          className="font-semibold text-base flex-1"
          style={{ color: t.accent }}
        >
          {title}
        </Text>
      </View>
      {description && (
        <Text className="text-white/50 text-sm leading-5">{description}</Text>
      )}
      {action && (
        <Pressable
          onPress={() => {
            haptics.medium();
            action.onPress();
          }}
          disabled={action.loading}
          className={`${t.button} rounded-xl py-3.5 items-center mt-4 ${
            action.loading ? "opacity-60" : "active:opacity-80"
          }`}
        >
          {action.loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-bold">
              {action.label}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
