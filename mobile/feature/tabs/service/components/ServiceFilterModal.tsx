import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceStatusFilter, ServiceSortOption, PriceRange } from "../types";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";

interface ServiceFilterModalProps {
  visible: boolean;
  onClose: () => void;
  statusFilter: ServiceStatusFilter;
  onStatusChange: (status: ServiceStatusFilter) => void;
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  onClearFilters: () => void;
  sortOption: ServiceSortOption;
  onSortChange: (sort: ServiceSortOption) => void;
  priceRange: PriceRange;
  onPriceRangeChange: (range: PriceRange) => void;
}

const STATUS_OPTIONS: ServiceStatusFilter[] = ["all", "available", "unavailable"];

const SORT_OPTIONS: { value: ServiceSortOption; label: string; icon: string }[] = [
  { value: "default", label: "Default", icon: "apps-outline" },
  { value: "price_low", label: "Price: Low to High", icon: "arrow-up-outline" },
  { value: "price_high", label: "Price: High to Low", icon: "arrow-down-outline" },
  { value: "duration_short", label: "Duration: Shortest", icon: "time-outline" },
  { value: "duration_long", label: "Duration: Longest", icon: "hourglass-outline" },
  { value: "newest", label: "Newest First", icon: "calendar-outline" },
];

export function ServiceFilterModal({
  visible,
  onClose,
  statusFilter,
  onStatusChange,
  selectedCategories,
  onToggleCategory,
  onClearFilters,
  sortOption,
  onSortChange,
  priceRange,
  onPriceRangeChange,
}: ServiceFilterModalProps) {
  // Local state for price inputs (to handle empty string properly)
  const [minPriceInput, setMinPriceInput] = useState(
    priceRange.min !== null ? priceRange.min.toString() : ""
  );
  const [maxPriceInput, setMaxPriceInput] = useState(
    priceRange.max !== null ? priceRange.max.toString() : ""
  );

  const handleMinPriceChange = (text: string) => {
    setMinPriceInput(text);
    const value = text === "" ? null : parseFloat(text);
    if (text === "" || (!isNaN(value!) && value! >= 0)) {
      onPriceRangeChange({ ...priceRange, min: value });
    }
  };

  const handleMaxPriceChange = (text: string) => {
    setMaxPriceInput(text);
    const value = text === "" ? null : parseFloat(text);
    if (text === "" || (!isNaN(value!) && value! >= 0)) {
      onPriceRangeChange({ ...priceRange, max: value });
    }
  };

  const handleClearAll = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    onClearFilters();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-zinc-900 rounded-t-3xl max-h-[85%]">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-zinc-800">
            <Text className="text-white text-lg font-semibold">Filters & Sort</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </Pressable>
          </View>

          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            {/* Sort By Section */}
            <View className="mb-6">
              <Text className="text-white text-base font-semibold mb-3">
                Sort By
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SORT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => onSortChange(option.value)}
                    className={`flex-row items-center px-3 py-2 rounded-full ${
                      sortOption === option.value
                        ? "bg-[#FFCC00]"
                        : "bg-zinc-800"
                    }`}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={14}
                      color={sortOption === option.value ? "#000" : "#9CA3AF"}
                    />
                    <Text
                      className={`ml-1.5 text-sm ${
                        sortOption === option.value
                          ? "text-black font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Price Range Section */}
            <View className="mb-6">
              <Text className="text-white text-base font-semibold mb-3">
                Price Range
              </Text>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-gray-400 text-xs mb-1.5">Min Price</Text>
                  <View className="flex-row items-center bg-zinc-800 rounded-lg px-3 py-2">
                    <Text className="text-gray-400 mr-1">$</Text>
                    <TextInput
                      value={minPriceInput}
                      onChangeText={handleMinPriceChange}
                      placeholder="0"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                      className="flex-1 text-white text-base"
                    />
                  </View>
                </View>
                <Text className="text-gray-500 mt-5">—</Text>
                <View className="flex-1">
                  <Text className="text-gray-400 text-xs mb-1.5">Max Price</Text>
                  <View className="flex-row items-center bg-zinc-800 rounded-lg px-3 py-2">
                    <Text className="text-gray-400 mr-1">$</Text>
                    <TextInput
                      value={maxPriceInput}
                      onChangeText={handleMaxPriceChange}
                      placeholder="Any"
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                      className="flex-1 text-white text-base"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Status Filter */}
            <View className="mb-6">
              <Text className="text-white text-base font-semibold mb-3">
                Status
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => onStatusChange(status)}
                    className={`px-4 py-2 rounded-full ${
                      statusFilter === status
                        ? "bg-[#FFCC00]"
                        : "bg-zinc-800"
                    }`}
                  >
                    <Text
                      className={`capitalize ${
                        statusFilter === status
                          ? "text-black font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {status}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Categories Filter */}
            <View className="mb-6">
              <Text className="text-white text-base font-semibold mb-3">
                Categories
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SERVICE_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.value}
                    onPress={() => onToggleCategory(cat.value)}
                    className={`px-4 py-2 rounded-full ${
                      selectedCategories.includes(cat.value)
                        ? "bg-[#FFCC00]"
                        : "bg-zinc-800"
                    }`}
                  >
                    <Text
                      className={`${
                        selectedCategories.includes(cat.value)
                          ? "text-black font-semibold"
                          : "text-gray-400"
                      }`}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 pb-8">
              <Pressable
                onPress={handleClearAll}
                className="flex-1 py-3 rounded-full border border-zinc-700"
              >
                <Text className="text-white text-center font-semibold">
                  Clear All
                </Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                className="flex-1 py-3 rounded-full bg-[#FFCC00]"
              >
                <Text className="text-black text-center font-semibold">
                  Apply Filters
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
