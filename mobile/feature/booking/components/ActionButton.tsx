import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ActionButtonProps {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  iconComponent?: React.ReactNode;
  bg?: string;
  color?: string;
  textColor?: string;
  variant?: "outline";
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  flex?: boolean;
}

export default function ActionButton({
  label, icon, iconComponent, bg, color, textColor,
  variant, onPress, disabled, loading, flex,
}: ActionButtonProps) {
  const isSolid = !variant;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`py-4 rounded-xl items-center ${flex ? "flex-1" : ""}`}
      style={{
        backgroundColor: isSolid && bg ? bg : variant === "outline" ? (color ? color + "10" : "transparent") : "transparent",
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: variant === "outline" ? (color ? color + "80" : "#333") : "transparent",
        opacity: disabled && !loading ? 0.5 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor || color || "#fff"} />
      ) : (
        <View className="flex-row items-center">
          {iconComponent || (icon && <Feather name={icon} size={20} color={textColor || color || "#fff"} />)}
          <Text className="font-semibold text-base ml-2" style={{ color: textColor || color || "#fff" }}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
