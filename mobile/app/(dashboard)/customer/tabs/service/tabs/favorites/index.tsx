import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import React from "react";
import { ServiceData } from "@/interfaces/service.interface";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import ServiceCard from "@/components/shared/ServiceCard";
import { useFavorite } from "@/hooks/favorite/useFavorite";

export default function FavoritesTab() {
  const { useGetFavorites } = useFavorite();
  const {
    data: favoritesData,
    isLoading,
    error,
    refetch,
  } = useGetFavorites();

  const handleServicePress = (item: ServiceData) => {
    router.push(`/customer/service/${item.serviceId}`);
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <ServiceCard
      imageUrl={item.imageUrl}
      category={getCategoryLabel(item.category)}
      title={item.serviceName}
      description={item.description}
      price={item.priceUsd}
      duration={item.durationMinutes}
      onPress={() => handleServicePress(item)}
      showFavoriteButton
      serviceId={item.serviceId}
      isFavorited={true}
    />
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-gray-400 mt-4">Loading favorites...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center">
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-red-500 mt-4">Failed to load favorites</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 px-6 py-3 bg-[#FFCC00] rounded-xl"
        >
          <Text className="text-black font-semibold">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const favorites = favoritesData || [];

  return (
    <React.Fragment>
      {/* Favorites count */}
      <View className="mb-4">
        <Text className="text-gray-400 text-sm">
          {favorites.length} favorite{favorites.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item, index) => `${item.serviceId}-${index}`}
        renderItem={renderServiceItem}
        numColumns={2}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor="#FFCC00"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center pt-20">
            <Ionicons name="heart-outline" size={64} color="#666" />
            <Text className="text-gray-400 text-center mt-4 text-lg">
              No favorites yet
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-2 px-8">
              Tap the heart icon on any service to add it to your favorites
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/customer/tabs/service")}
              className="mt-6 px-6 py-3 bg-[#FFCC00] rounded-xl"
            >
              <Text className="text-black font-semibold">Browse Services</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </React.Fragment>
  );
}
