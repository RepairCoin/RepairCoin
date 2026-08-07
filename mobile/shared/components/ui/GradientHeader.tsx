import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Frozen tuples: expo-linear-gradient types `colors` as a readonly tuple, and an inline
// array inside a ternary widens to string[] and fails typecheck.
const CUSTOMER_COLORS = ["#E0A800", "#181203", "#0A0A0A"] as const;
/** Matches the shop dashboard header in feature/home/screens/shop/ShopHomeScreen.tsx. */
const SHOP_COLORS = ["#E0A800", "#4A3B00", "#0A0A0A"] as const;

interface GradientHeaderProps {
  /** Centered title text (title mode). Omit when passing custom `children`. */
  title?: string;
  /** Show a back chevron on the left. */
  showBack?: boolean;
  onBack?: () => void;
  /** Right-aligned slot (e.g. a settings button). */
  right?: React.ReactNode;
  /** Custom content rendered below the title row (e.g. a search bar). */
  children?: React.ReactNode;
  /** Extra bottom padding inside the gradient. */
  className?: string;
  /**
   * Palette and shape. "customer" (default) is the V2 look used by Home, My Account,
   * Per Industry and Notifications. "shop" matches the shop dashboard header: brighter
   * mid-stop and rounded bottom corners.
   */
  variant?: "customer" | "shop";
}

/**
 * V2 gold→black gradient top bar shared across Home, My Account, Per Industry
 * and Notifications. Handles the status-bar safe area itself.
 */
export default function GradientHeader({
  title,
  showBack = false,
  onBack,
  right,
  children,
  className,
  variant = "customer",
}: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  const isShop = variant === "shop";

  return (
    <LinearGradient
      colors={isShop ? SHOP_COLORS : CUSTOMER_COLORS}
      locations={isShop ? undefined : [0, 0.75, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={
        isShop
          ? {
              paddingTop: insets.top + 16,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }
          : { paddingTop: insets.top + 6 }
      }
    >
      <View className={`px-4 ${isShop ? "pb-[22px]" : "pb-4"} ${className ?? ""}`}>
        {(title || showBack || right) && (
          <View className="flex-row items-center justify-center min-h-[40px]">
            {showBack && (
              <TouchableOpacity
                onPress={onBack}
                className="absolute left-0 h-10 w-10 items-center justify-center"
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={26} color="#fff" />
              </TouchableOpacity>
            )}
            {title && (
              <Text className="text-white text-xl font-bold">{title}</Text>
            )}
            {right && <View className="absolute right-0">{right}</View>}
          </View>
        )}
        {children}
      </View>
    </LinearGradient>
  );
}
