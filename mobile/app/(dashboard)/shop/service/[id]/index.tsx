import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams, router } from "expo-router";
import { useService } from "@/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { useAuthStore } from "@/store/auth.store";

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetService, useUpdateService } = useService();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const { mutateAsync: updateServiceMutation } = useUpdateService();
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  const [isUpdating, setIsUpdating] = useState(false);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleToggleStatus = async (value: boolean) => {
    if (!isUpdating && serviceData) {
      setIsUpdating(true);
      try {
        await updateServiceMutation({
          serviceId: id!,
          serviceData: { active: value },
        });

        await queryClient.invalidateQueries({
          queryKey: queryKeys.service(id!),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.shopServices(shopId!),
        });

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

  const handleEdit = () => {
    if (serviceData) {
      router.push({
        pathname: "/shop/service-form",
        params: {
          mode: "edit",
          serviceId: serviceData.serviceId,
          data: JSON.stringify(serviceData),
        },
      });
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (error || !serviceData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={goBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Service not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          {serviceData.imageUrl ? (
            <Image
              source={{ uri: serviceData.imageUrl }}
              className="w-full h-64"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-64 bg-gray-800 items-center justify-center">
              <Ionicons name="image-outline" size={64} color="#6B7280" />
            </View>
          )}

          {/* Back Button Overlay */}
          <TouchableOpacity
            onPress={goBack}
            className="absolute top-14 left-4 bg-black/50 rounded-full p-2"
          >
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>

          {/* Status Badge */}
          <View
            className={`absolute top-14 right-4 px-3 py-1 rounded-full ${
              serviceData.active ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <Text className="text-white text-sm font-medium">
              {serviceData.active ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Category & Duration */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="bg-gray-800 px-3 py-1 rounded-full">
              <Text className="text-gray-400 text-xs uppercase">
                {getCategoryLabel(serviceData.category)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={16} color="#9CA3AF" />
              <Text className="text-gray-400 text-sm ml-1">
                {serviceData.durationMinutes} min
              </Text>
            </View>
          </View>

          {/* Service Name */}
          <Text className="text-white text-2xl font-bold mb-2">
            {serviceData.serviceName}
          </Text>

          {/* Price */}
          <Text className="text-[#FFCC00] text-3xl font-bold mb-4">
            ${serviceData.priceUsd}
          </Text>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-gray-400 text-base leading-6">
              {serviceData.description || "No description available."}
            </Text>
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Service Status Toggle */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Service Settings
            </Text>

            <View className="bg-gray-900 rounded-xl p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-gray-800 rounded-full p-2 mr-3">
                    <Ionicons
                      name={serviceData.active ? "checkmark-circle" : "close-circle"}
                      size={20}
                      color={serviceData.active ? "#22c55e" : "#ef4444"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-base">Service Status</Text>
                    <Text className="text-gray-500 text-xs mt-1">
                      {serviceData.active
                        ? "Visible to customers"
                        : "Hidden from customers"}
                    </Text>
                  </View>
                </View>
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#FFCC00" />
                ) : (
                  <Switch
                    value={serviceData.active}
                    onValueChange={handleToggleStatus}
                    trackColor={{ false: "#374151", true: "#22c55e" }}
                    thumbColor={serviceData.active ? "#fff" : "#9CA3AF"}
                    disabled={isUpdating}
                  />
                )}
              </View>
            </View>
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Additional Info */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Additional Information
            </Text>

            <View className="flex-row items-center mb-3">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="pricetag-outline" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Service ID</Text>
                <Text className="text-white text-sm">
                  {serviceData.serviceId}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Created On</Text>
                <Text className="text-white text-base">
                  {formatDate(serviceData.createdAt)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="refresh-outline" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Last Updated</Text>
                <Text className="text-white text-base">
                  {formatDate(serviceData.updatedAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Tags */}
          {serviceData.tags && serviceData.tags.length > 0 && (
            <>
              <View className="h-px bg-gray-800 mb-6" />
              <View className="mb-6">
                <Text className="text-white text-lg font-semibold mb-4">
                  Tags
                </Text>
                <View className="flex-row flex-wrap">
                  {serviceData.tags.map((tag, index) => (
                    <View
                      key={index}
                      className="bg-gray-800 px-3 py-1 rounded-full mr-2 mb-2"
                    >
                      <Text className="text-gray-400 text-sm">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-gray-800">
        <TouchableOpacity
          onPress={handleEdit}
          className="bg-[#FFCC00] rounded-xl py-4 flex-row items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="pencil" size={20} color="black" />
          <Text className="text-black text-lg font-bold ml-2">Edit Service</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
