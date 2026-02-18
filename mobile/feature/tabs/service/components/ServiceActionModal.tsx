import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceData } from "@/shared/interfaces/service.interface";

interface ServiceActionModalProps {
  visible: boolean;
  service: ServiceData | null;
  isUpdating: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: (value: boolean) => void;
  onViewDetails?: () => void;
}

export function ServiceActionModal({
  visible,
  service,
  isUpdating,
  onClose,
  onEdit,
  onToggleStatus,
  onViewDetails,
}: ServiceActionModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 justify-end bg-black/50"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-t-3xl"
        >
          {/* Modal Header */}
          <View className="p-4 border-b border-gray-800">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-lg font-semibold">
                Service Options
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {service && (
              <Text className="text-gray-400 text-sm">
                {service.serviceName}
              </Text>
            )}
          </View>

          {/* Options */}
          <View className="p-4">
            {/* Active/Inactive Toggle */}
            <View className="bg-gray-800 rounded-lg p-4 mb-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Ionicons
                    name={service?.active ? "checkmark-circle" : "close-circle"}
                    size={24}
                    color={service?.active ? "#10B981" : "#EF4444"}
                  />
                  <Text className="text-white ml-3">Service Status</Text>
                </View>
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFCC00" />
                ) : (
                  <Switch
                    value={service?.active || false}
                    onValueChange={onToggleStatus}
                    trackColor={{ false: "#374151", true: "#10B981" }}
                    thumbColor={service?.active ? "#fff" : "#9CA3AF"}
                    disabled={isUpdating}
                  />
                )}
              </View>
              <Text className="text-gray-500 text-xs mt-2 ml-9">
                {service?.active
                  ? "Service is visible to customers"
                  : "Service is hidden from customers"}
              </Text>
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              onPress={onEdit}
              className="bg-gray-800 rounded-lg p-4 mb-3 flex-row items-center"
            >
              <View className="bg-blue-500/20 rounded-full p-2">
                <Ionicons name="pencil" size={20} color="#3B82F6" />
              </View>
              <View className="ml-3">
                <Text className="text-white font-medium">Edit Service</Text>
                <Text className="text-gray-500 text-xs mt-1">
                  Modify details, price, or image
                </Text>
              </View>
            </TouchableOpacity>

            {/* View Details Button */}
            {onViewDetails && (
              <TouchableOpacity
                onPress={onViewDetails}
                className="bg-gray-800 rounded-lg p-4 mb-3 flex-row items-center"
              >
                <View className="bg-[#FFCC00]/20 rounded-full p-2">
                  <Ionicons name="eye" size={20} color="#FFCC00" />
                </View>
                <View className="ml-3">
                  <Text className="text-white font-medium">View Details & Reviews</Text>
                  <Text className="text-gray-500 text-xs mt-1">
                    See service info and customer reviews
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Padding for Safe Area */}
          <View className="h-8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
