import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  Alert,
  Switch,
} from "react-native";
import { ThemedView } from "@/components/ui/ThemedView";
import { Ionicons } from "@expo/vector-icons";
import { useService } from "@/hooks/service/useService";
import { useState } from "react";
import { ServiceData } from "@/services/ShopServices";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { queryKeys } from "@/config/queryClient";

export default function Service() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { useServiceQuery, useUpdateService } = useService();
  const { data: servicesData, isLoading, error, refetch } = useServiceQuery();
  const { mutateAsync: updateServiceMutation } = useUpdateService();

  const shopId = userProfile?.shopId;
  
  const [refreshing, setRefreshing] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleMenuPress = (item: ServiceData) => {
    setSelectedService(item);
    setActionModalVisible(true);
  };

  const handleEdit = () => {
    setActionModalVisible(false);
    if (selectedService) {
      router.push({
        pathname: "/shop/service-form",
        params: {
          mode: "edit",
          serviceId: selectedService.serviceId,
          data: JSON.stringify(selectedService)
        }
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
          serviceData: { active: value }
        });
        
        // Update local state
        setSelectedService({ ...selectedService, active: value });
        
        // Invalidate and refetch services list (use servicesBase for partial match)
        await queryClient.invalidateQueries({ queryKey: queryKeys.servicesBase(shopId!) });
        
        // Show success feedback
        Alert.alert(
          "Success", 
          `Service ${value ? 'activated' : 'deactivated'} successfully`
        );
      } catch (error) {
        console.error("Failed to update service status:", error);
        Alert.alert("Error", "Failed to update service status");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <View className="flex-1 mx-2 my-2">
      <TouchableOpacity 
        onPress={() => router.push(`/shop/service/${item.serviceId}`)}
        activeOpacity={0.8}
      >
        <View className="bg-gray-900 rounded-xl overflow-hidden">
          <View className="relative">
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                className="w-full h-28"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-28 bg-gray-800 items-center justify-center">
                <Ionicons
                  name="image-outline"
                  size={32}
                  color="#6B7280"
                />  
              </View>
            )}
            <View
              className={`absolute top-2 right-2 px-2 py-1 rounded-full ${item.active ? "bg-green-500" : "bg-gray-600"}`}
            >
              <Text className="text-white text-xs font-medium">
                {item.active ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>

          <View className="p-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs text-gray-500 uppercase tracking-wide">
                {getCategoryLabel(item.category)}
              </Text>
            </View>

            <Text
              className="text-white text-base font-semibold mb-1"
              numberOfLines={1}
            >
              {item.serviceName}
            </Text>

            <Text
              className="text-gray-400 text-xs leading-4 mb-3"
              numberOfLines={2}
            >
              {item.description}
            </Text>

            <View className="border-t border-gray-800 pt-3 flex-row items-center justify-between">
              <Text className="text-[#FFCC00] font-bold text-lg">
                ${item.priceUsd}
              </Text>
              <TouchableOpacity onPress={() => handleMenuPress(item)}>
                <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <ThemedView className="w-full h-full">
      <View className="pt-20 px-4 flex-1">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-semibold">Services</Text>
          <View className="w-[25px]" />
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#FFCC00" />
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-red-500">Failed to load services</Text>
            <TouchableOpacity onPress={() => refetch()} className="mt-2">
              <Text className="text-[#FFCC00]">Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={servicesData || []}
            keyExtractor={(item, index) => `${item.serviceId}-${index}`}
            renderItem={renderServiceItem}
            numColumns={2}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#FFCC00"
              />
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center pt-20">
                <Ionicons name="briefcase-outline" size={64} color="#666" />
                <Text className="text-gray-400 text-center mt-4">
                  No services yet
                </Text>
                <Text className="text-gray-500 text-sm text-center mt-2">
                  Tap the + button to add your first service
                </Text>
              </View>
            }
          />
        )}
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
                <Text className="text-white text-lg font-semibold">Service Options</Text>
                <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {selectedService && (
                <Text className="text-gray-400 text-sm">{selectedService.serviceName}</Text>
              )}
            </View>

            {/* Options */}
            <View className="p-4">
              {/* Active/Inactive Toggle */}
              <View className="bg-gray-800 rounded-lg p-4 mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons 
                      name={selectedService?.active ? "checkmark-circle" : "close-circle"} 
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
                  {selectedService?.active ? "Service is visible to customers" : "Service is hidden from customers"}
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
                  <Text className="text-gray-500 text-xs mt-1">Modify details, price, or image</Text>
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
