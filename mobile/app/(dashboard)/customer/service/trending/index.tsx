import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useService } from "@/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import ServiceCard from "@/components/shared/ServiceCard";
import { ServiceData } from "@/interfaces/service.interface";
import { AppHeader } from "@/components/ui/AppHeader";

export default function TrendingServices() {
  const { useGetTrendingServices } = useService();
  const {
    data: trendingServices,
    isLoading,
    refetch,
  } = useGetTrendingServices({ limit: 6, days: 7 });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleServicePress = (item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  };

  const renderServiceCard = ({ item }: { item: ServiceData }) => (
    <ServiceCard
      imageUrl={item.imageUrl}
      category={getCategoryLabel(item.category)}
      title={item.serviceName}
      description={item.description}
      price={item.priceUsd}
      duration={item.durationMinutes}
      onPress={() => handleServicePress(item)}
      showTrendingBadge
    />
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="trending-up-outline" size={64} color="#6B7280" />
      <Text className="text-gray-400 text-lg mt-4">No trending services</Text>
      <Text className="text-gray-500 text-sm text-center mt-2 px-8">
        Check back later for popular services
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <AppHeader title="Trending Services" />

      {/* Services List */}
      <FlatList
        data={trendingServices}
        renderItem={renderServiceCard}
        keyExtractor={(item) => item.serviceId}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFCC00"
            colors={["#FFCC00"]}
          />
        }
      />
    </View>
  );
}
