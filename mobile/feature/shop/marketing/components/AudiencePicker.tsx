import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AUDIENCE_OPTIONS, LAPSED_DAY_OPTIONS } from "../constants/marketingConstants";
import { CampaignAudienceType } from "../services/marketing.interface";
import { CustomerSelectModal } from "./CustomerSelectModal";

interface AudiencePickerProps {
  audienceType: CampaignAudienceType;
  onChangeAudienceType: (type: CampaignAudienceType) => void;
  audienceFilters: Record<string, any>;
  onChangeAudienceFilters: (filters: Record<string, any>) => void;
  selectedAddresses: Set<string>;
  onToggleSelectedAddress: (address: string) => void;
  audienceCount?: number;
  isAudienceCountLoading: boolean;
}

export function AudiencePicker({
  audienceType,
  onChangeAudienceType,
  audienceFilters,
  onChangeAudienceFilters,
  selectedAddresses,
  onToggleSelectedAddress,
  audienceCount,
  isAudienceCountLoading,
}: AudiencePickerProps) {
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  return (
    <View>
      {AUDIENCE_OPTIONS.map((option) => {
        const isSelected = audienceType === option.value;
        return (
          <View key={option.value} className="mb-2">
            <TouchableOpacity
              onPress={() => onChangeAudienceType(option.value)}
              activeOpacity={0.7}
              className={`flex-row items-center justify-between px-4 py-4 rounded-xl border ${
                isSelected ? "bg-[#FFCC00]/10 border-[#FFCC00]" : "bg-[#1A1A1A] border-[#222]"
              }`}
            >
              <View className="flex-1 mr-3">
                <Text className={`text-base ${isSelected ? "text-[#FFCC00] font-semibold" : "text-gray-300"}`}>
                  {option.label}
                </Text>
                {option.description && (
                  <Text className="text-gray-500 text-xs mt-0.5">{option.description}</Text>
                )}
              </View>
              <Ionicons
                name={isSelected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={isSelected ? "#FFCC00" : "#6B7280"}
              />
            </TouchableOpacity>

            {isSelected && option.value === "select_customers" && (
              <TouchableOpacity
                onPress={() => setShowCustomerModal(true)}
                activeOpacity={0.7}
                className="flex-row items-center justify-between bg-zinc-900 rounded-xl px-4 py-3 mt-2"
              >
                <Text className="text-white text-sm">
                  {selectedAddresses.size === 0
                    ? "Select customers"
                    : `${selectedAddresses.size} customer${selectedAddresses.size !== 1 ? "s" : ""} selected`}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {isSelected && option.value === "custom" && (
              <View className="flex-row bg-zinc-900 rounded-xl p-1 mt-2">
                {LAPSED_DAY_OPTIONS.map((days) => {
                  const isDaysSelected = audienceFilters.lapsedDays === days;
                  return (
                    <TouchableOpacity
                      key={days}
                      onPress={() => onChangeAudienceFilters({ ...audienceFilters, lapsedDays: days })}
                      className={`flex-1 py-2.5 rounded-lg items-center ${
                        isDaysSelected ? "bg-[#FFCC00]" : ""
                      }`}
                    >
                      <Text className={isDaysSelected ? "text-black font-semibold" : "text-gray-400"}>
                        {days}+ days
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      <View className="flex-row items-center justify-center mt-3">
        {isAudienceCountLoading ? (
          <>
            <ActivityIndicator size="small" color="#FFCC00" />
            <Text className="text-gray-400 text-sm ml-2">Counting recipients…</Text>
          </>
        ) : (
          <Text className="text-gray-300 text-sm">
            ≈ {(audienceCount ?? 0).toLocaleString()} recipient{audienceCount === 1 ? "" : "s"}
          </Text>
        )}
      </View>

      <CustomerSelectModal
        visible={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        selectedAddresses={selectedAddresses}
        onToggleAddress={onToggleSelectedAddress}
      />
    </View>
  );
}
