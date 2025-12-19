import React from "react";
import { View, TextInput, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  variant?: "default" | "filled";
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search...",
  variant = "default",
}: SearchInputProps) {
  const containerStyle =
    variant === "filled"
      ? "bg-zinc-800 rounded-full"
      : "border-2 border-[#666] rounded-full";

  const iconColor = variant === "filled" ? "#9CA3AF" : "#666";

  return (
    <View
      className={`flex-row items-center w-full ${containerStyle} ${
        Platform.OS === "ios" ? "px-4 py-2" : "px-4"
      }`}
    >
      <Feather name="search" size={20} color={iconColor} />
      <TextInput
        className="flex-1 text-white ml-3 text-left py-1"
        placeholder={placeholder}
        placeholderTextColor={variant === "filled" ? "#6B7280" : "#666"}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")}>
          <Feather name="x-circle" size={20} color={iconColor} />
        </Pressable>
      )}
    </View>
  );
}
