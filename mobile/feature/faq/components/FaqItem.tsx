import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Faq } from "../constants/faqs";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FaqItemProps {
  faq: Faq;
  isOpen: boolean;
  onToggle: () => void;
}

export function FaqItem({ faq, isOpen, onToggle }: FaqItemProps) {
  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <View className="bg-[#1A1A1A] border border-zinc-800 rounded-xl overflow-hidden">
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        className="flex-row items-center justify-between px-5 py-4"
      >
        <Text className="text-base font-medium text-white flex-1 pr-4">
          {faq.question}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={18}
          color="#6b7280"
        />
      </TouchableOpacity>

      {isOpen && (
        <View className="px-5 pb-5">
          <Text className="text-sm text-gray-400 leading-relaxed">
            {faq.answer}
          </Text>
        </View>
      )}
    </View>
  );
}
