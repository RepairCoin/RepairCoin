import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceStatusFilter } from "../types";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";

interface ServiceFilterModalProps {
  visible: boolean;
  onClose: () => void;
  statusFilter: ServiceStatusFilter;
  onStatusChange: (status: ServiceStatusFilter) => void;
  selectedCategories: string[];
  onToggleCategory: (category: string) => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS: ServiceStatusFilter[] = ["all", "available", "unavailable"];

export function ServiceFilterModal({
  visible,
  onClose,
  statusFilter,
  onStatusChange,
  selectedCategories,
  onToggleCategory,
  onClearFilters,
}: ServiceFilterModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-zinc-900 rounded-t-3xl max-h-[80%]">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-zinc-800">
            <Text className="text-white text-lg font-semibold">Filters</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </Pressable>
          </View>

          <ScrollView className="p-4">
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
                onPress={onClearFilters}
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
