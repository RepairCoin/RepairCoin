import { Text, View, TouchableOpacity, Image, ActivityIndicator, FlatList, RefreshControl } from "react-native";
import React from "react";
import { useService } from "@/hooks/service/useService";
import { ServiceData } from "@/interfaces/service.interface";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";

export default function ServicesTab() {
  const { useGetAllServicesQuery } = useService();
  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
  } = useGetAllServicesQuery();

  const [refreshing, setRefreshing] = React.useState(false);

  const activeServices =
    servicesData?.filter((service: ServiceData) => service.active) || [];

  const handleServicePress = (item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  };

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

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <View className="flex-1 mx-2 my-2">
      <TouchableOpacity
        onPress={() => handleServicePress(item)}
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
                <Ionicons name="image-outline" size={32} color="#6B7280" />
              </View>
            )}
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
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text className="text-gray-400 text-xs ml-1">
                  {item.durationMinutes} min
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <React.Fragment>
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
          data={activeServices}
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
                No services available
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                Check back later for new services
              </Text>
            </View>
          }
        />
      )}
    </React.Fragment>
  );
}
