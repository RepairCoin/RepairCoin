import React from "react";
import { Modal, TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface FilterOption {
  key: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

interface FilterModalProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  options: FilterOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  visible: boolean;
  onClose: () => void;
  iconColor?: string;
}

export function FilterModal({
  title,
  icon,
  options,
  selectedKey,
  onSelect,
  visible,
  onClose,
  iconColor = "#FFCC00",
}: FilterModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/60 justify-end"
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View className="bg-zinc-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-zinc-800">
              <View className="flex-row items-center">
                <Ionicons name={icon} size={20} color={iconColor} />
                <Text className="text-white text-lg font-semibold ml-2">{title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} className="p-1">
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="px-4 py-3">
              {options.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  className={`flex-row items-center justify-between px-4 py-4 rounded-xl mb-2 ${
                    selectedKey === option.key ? "bg-zinc-800" : ""
                  }`}
                >
                  <View className="flex-row items-center">
                    {option.color && (
                      <View
                        className="w-3 h-3 rounded-full mr-3"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    {option.icon && !option.color && (
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={selectedKey === option.key ? iconColor : "#9CA3AF"}
                        style={{ marginRight: 12 }}
                      />
                    )}
                    <Text
                      className={`text-base ${
                        selectedKey === option.key ? "text-[#FFCC00] font-semibold" : "text-gray-300"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {selectedKey === option.key && (
                    <Ionicons name="checkmark-circle" size={22} color={iconColor} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Bottom safe area */}
            <View className="h-8" />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
