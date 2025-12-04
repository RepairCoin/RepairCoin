import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import React from "react";
import { useService } from "@/hooks/service/useService";
import { ServiceData } from "@/interfaces/service.interface";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import ServiceCard from "@/components/shared/ServiceCard";

export default function ServicesTab({
    setActionModalVisible,
    setSelectedService,
}: {
    setActionModalVisible: (visible: boolean) => void;
    setSelectedService: (service: ServiceData) => void;
}) {
  const { useShopServicesQuery } = useService();
  const {
    data: servicesData,
    isLoading,
    error,
    refetch,
  } = useShopServicesQuery();

  const [refreshing, setRefreshing] = React.useState(false);

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

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <ServiceCard
      imageUrl={item.imageUrl}
      category={getCategoryLabel(item.category)}
      title={item.serviceName}
      description={item.description}
      price={item.priceUsd}
      badgeStatus={{
        label: item.active ? "Active" : "Inactive",
        active: item.active,
      }}
      onPress={() => router.push(`/shop/service/${item.serviceId}`)}
      showMenu
      menuPosition="footer"
      onMenuPress={() => handleMenuPress(item)}
    />
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
    </React.Fragment>
  );
}
