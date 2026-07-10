import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface MenuRowProps {
  /** Ionicons name for the leading icon. */
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  /** Optional content rendered before the chevron (e.g. a value or badge). */
  rightSlot?: React.ReactNode;
  iconColor?: string;
  /** Hide the trailing chevron. */
  showChevron?: boolean;
  /** Hide the bottom divider (e.g. last row in a group). */
  isLast?: boolean;
}

/**
 * Icon + label + chevron settings/menu row. Used by the V2 My Account menu
 * (Tier Progress, My QR Code, Refer a Friend, Refer a Shop, Support) and
 * reusable for any settings-style list.
 */
function MenuRow({
  icon,
  label,
  onPress,
  rightSlot,
  iconColor = "#FFFFFF",
  showChevron = true,
  isLast = false,
}: MenuRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      className={`flex-row items-center px-4 py-4 ${
        isLast ? "" : "border-b border-zinc-800"
      }`}
    >
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text className="flex-1 text-white text-base font-medium ml-4">
        {label}
      </Text>
      {rightSlot}
      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color="#FFCC00"
          style={{ marginLeft: 8 }}
        />
      )}
    </TouchableOpacity>
  );
}

export default React.memo(MenuRow);
