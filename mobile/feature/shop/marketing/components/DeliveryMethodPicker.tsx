import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DELIVERY_METHOD_OPTIONS } from "../constants/marketingConstants";
import { CampaignDeliveryMethod } from "../services/marketing.interface";

export function DeliveryMethodPicker({
  value,
  onChange,
}: {
  value: CampaignDeliveryMethod;
  onChange: (value: CampaignDeliveryMethod) => void;
}) {
  return (
    <View>
      {DELIVERY_METHOD_OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.7}
            className={`flex-row items-center justify-between px-4 py-4 rounded-xl mb-2 border ${
              isSelected ? "bg-[#FFCC00]/10 border-[#FFCC00]" : "bg-[#1A1A1A] border-[#222]"
            }`}
          >
            <Text className={`text-base ${isSelected ? "text-[#FFCC00] font-semibold" : "text-gray-300"}`}>
              {option.label}
            </Text>
            <Ionicons
              name={isSelected ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={isSelected ? "#FFCC00" : "#6B7280"}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
