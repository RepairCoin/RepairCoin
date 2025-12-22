import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Switch,
  Pressable,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useService } from "@/hooks/service/useService";
import { useState } from "react";
import { ServiceData } from "@/interfaces/service.interface";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";
import ServicesTab from "./tabs/services";
import BookingsTab from "./tabs/bookings";

type ServiceTab = "Services" | "Booking";
const serviceTabs: ServiceTab[] = ["Services", "Booking"];

export default function Service() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { useUpdateService } = useService();

  const { mutateAsync: updateServiceMutation } = useUpdateService();

  const shopId = userProfile?.shopId;

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(
    null
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<ServiceTab>("Services");

  const handleEdit = () => {
    setActionModalVisible(false);
    if (selectedService) {
      router.push({
        pathname: "/shop/service-form",
        params: {
          mode: "edit",
          serviceId: selectedService.serviceId,
          data: JSON.stringify(selectedService),
        },
      });
    }
  };

  const handleToggleStatus = async (value: boolean) => {
    if (selectedService && !isUpdating) {
      setIsUpdating(true);
      try {
        // Update the service status
        await updateServiceMutation({
          serviceId: selectedService.serviceId,
          serviceData: { active: value },
        });

        // Update local state
        setSelectedService({ ...selectedService, active: value });

        // Invalidate and refetch services list (use servicesBase for partial match)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.shopServices(shopId!),
        });

        // Show success feedback
        Alert.alert(
          "Success",
          `Service ${value ? "activated" : "deactivated"} successfully`
        );
      } catch (error) {
        console.error("Failed to update service status:", error);
        Alert.alert("Error", "Failed to update service status");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 gap-4 flex-1">
        <View className="flex-row w-full h-10 bg-[#121212] rounded-xl">
          {serviceTabs.map((tab, i) => (
            <Pressable
              key={i}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 items-center justify-center ${
                activeTab === tab ? "bg-[#FFCC00]" : "bg-[#121212]"
              } ${i === 0 ? "rounded-l-lg" : "rounded-r-lg"}`}
            >
              <Text
                className={`text-base font-bold ${
                  activeTab === tab ? "text-black" : "text-gray-400"
                }`}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "Services" && (
          <ServicesTab
            setActionModalVisible={setActionModalVisible}
            setSelectedService={setSelectedService}
          />
        )}
        {activeTab === "Booking" && <BookingsTab />}
      </View>

      <TouchableOpacity
        onPress={() => router.push("/shop/service-form")}
        className="absolute bottom-6 right-6 bg-[#FFCC00] w-14 h-14 rounded-full items-center justify-center"
        style={{
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        <Ionicons name="add" size={28} color="black" />
      </TouchableOpacity>

      {/* Service Action Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={actionModalVisible}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
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
                <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {selectedService && (
                <Text className="text-gray-400 text-sm">
                  {selectedService.serviceName}
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
                      name={
                        selectedService?.active
                          ? "checkmark-circle"
                          : "close-circle"
                      }
                      size={24}
                      color={selectedService?.active ? "#10B981" : "#EF4444"}
                    />
                    <Text className="text-white ml-3">Service Status</Text>
                  </View>
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFCC00" />
                  ) : (
                    <Switch
                      value={selectedService?.active || false}
                      onValueChange={handleToggleStatus}
                      trackColor={{ false: "#374151", true: "#10B981" }}
                      thumbColor={selectedService?.active ? "#fff" : "#9CA3AF"}
                      disabled={isUpdating}
                    />
                  )}
                </View>
                <Text className="text-gray-500 text-xs mt-2 ml-9">
                  {selectedService?.active
                    ? "Service is visible to customers"
                    : "Service is hidden from customers"}
                </Text>
              </View>

              {/* Edit Button */}
              <TouchableOpacity
                onPress={handleEdit}
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
            </View>

            {/* Bottom Padding for Safe Area */}
            <View className="h-8" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}
