import React from "react";
import { View, Text } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export type BadgeTone =
  | "trending"
  | "discount"
  | "group"
  | "rank"
  | "neutral";

type IconLib = "ionicons" | "material-community";

interface ToneStyle {
  bg: string;
  text: string;
  icon?: { name: string; lib: IconLib };
}

const TONES: Record<BadgeTone, ToneStyle> = {
  trending: {
    bg: "#FF6B35",
    text: "#FFFFFF",
    icon: { name: "fire", lib: "material-community" },
  },
  rank: {
    bg: "#FF3B30",
    text: "#FFFFFF",
    icon: { name: "flame", lib: "ionicons" },
  },
  discount: {
    bg: "#EF4444",
    text: "#FFFFFF",
  },
  group: {
    bg: "#EC4899",
    text: "#FFFFFF",
    icon: { name: "gift", lib: "ionicons" },
  },
  neutral: {
    bg: "#3F3F46",
    text: "#FFFFFF",
  },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Override the tone's default icon. Pass null to hide the icon entirely. */
  icon?: { name: string; lib?: IconLib } | null;
  size?: "sm" | "md";
}

/**
 * Generic pill used across service cards (trending / discount / group-reward /
 * rank) and elsewhere. Replaces the ad-hoc pill markup that was duplicated
 * inside ServiceCard and CampaignCard.
 */
function Badge({ label, tone = "neutral", icon, size = "sm" }: BadgeProps) {
  const t = TONES[tone];
  const resolvedIcon =
    icon === null
      ? undefined
      : icon
      ? { name: icon.name, lib: icon.lib ?? "ionicons" }
      : t.icon;

  const iconSize = size === "md" ? 12 : 10;
  const textClass = size === "md" ? "text-xs" : "text-[10px]";
  const pad = size === "md" ? "px-2 py-1" : "px-1.5 py-0.5";

  return (
    <View
      className={`flex-row items-center rounded-full ${pad}`}
      style={{ backgroundColor: t.bg }}
    >
      {resolvedIcon &&
        (resolvedIcon.lib === "material-community" ? (
          <MaterialCommunityIcons
            name={resolvedIcon.name as any}
            size={iconSize}
            color={t.text}
            style={{ marginRight: 3 }}
          />
        ) : (
          <Ionicons
            name={resolvedIcon.name as any}
            size={iconSize}
            color={t.text}
            style={{ marginRight: 3 }}
          />
        ))}
      <Text
        className={`${textClass} font-semibold`}
        style={{ color: t.text }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export default React.memo(Badge);
