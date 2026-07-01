import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getTierConfig } from "@/shared/utilities/getTier";

type TierBadgeSize = "sm" | "md";
type TierBadgeVariant = "soft" | "outline";

interface TierBadgeProps {
  /** Raw tier value from the API (case-insensitive). Unknown/undefined renders a neutral badge, never a fake Bronze. */
  tier?: string;
  size?: TierBadgeSize;
  variant?: TierBadgeVariant;
  showIcon?: boolean;
}

const SIZES: Record<
  TierBadgeSize,
  { container: string; icon: number; text: string }
> = {
  sm: { container: "px-2 py-0.5", icon: 11, text: "text-[9px]" },
  md: { container: "px-2.5 py-1", icon: 12, text: "text-xs" },
};

/**
 * Canonical tier badge. Colors/icons come from the shared `getTierConfig`
 * so every surface (rewards, customers, orders) styles Gold/Silver/Bronze
 * identically — and unknown tiers get a distinct neutral style instead of
 * silently looking like Bronze.
 */
export default function TierBadge({
  tier,
  size = "md",
  variant = "soft",
  showIcon = true,
}: TierBadgeProps) {
  const config = getTierConfig(tier ?? "");
  const s = SIZES[size];
  const label = tier ? tier.toUpperCase() : "UNKNOWN";

  const style =
    variant === "outline"
      ? {
          backgroundColor: config.color + "1A",
          borderColor: config.color + "4D",
          borderWidth: 1,
        }
      : { backgroundColor: config.bgColor };

  return (
    <View
      className={`flex-row items-center rounded-full ${s.container}`}
      style={style}
    >
      {showIcon && (
        <MaterialCommunityIcons
          name={config.icon as any}
          size={s.icon}
          color={config.color}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        className={`${s.text} font-semibold uppercase`}
        style={{ color: config.color }}
      >
        {label}
      </Text>
    </View>
  );
}
