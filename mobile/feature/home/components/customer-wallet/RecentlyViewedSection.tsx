import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ServiceData } from "@/shared/interfaces/service.interface";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import { useFavorite } from "@/shared/hooks/favorite/useFavorite";

interface RecentlyViewedSectionProps {
  data: ServiceData[];
  isLoading: boolean;
  getCategoryLabel: (category?: string) => string;
  onServicePress: (service: ServiceData) => void;
}

export default function RecentlyViewedSection({
  data,
  isLoading,
  getCategoryLabel,
  onServicePress,
}: RecentlyViewedSectionProps) {
  const { useGetFavorites } = useFavorite();
  const { data: favoritesData } = useGetFavorites();

  // Create a Set of favorited service IDs for O(1) lookup
  const favoritedIds = React.useMemo(() => {
    if (!favoritesData) return new Set<string>();
    return new Set(favoritesData.map((s: ServiceData) => s.serviceId));
  }, [favoritesData]);

  const handleViewAll = () => {
    router.push("/customer/tabs/service");
  };

  return (
    <View className="mt-5">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={22} color="#FFCC00" />
          <Text className="text-white text-xl font-bold ml-1">Recently Viewed</Text>
        </View>
        <TouchableOpacity onPress={handleViewAll}>
          <Text className="text-[#FFCC00] text-sm font-semibold">View All</Text>
        </TouchableOpacity>
      </View>

      {/* Recently Viewed Cards - Horizontal Slider */}
      {isLoading ? (
        <View className="justify-center items-center py-10">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : data && data.length > 0 ? (
        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            decelerationRate="fast"
            snapToInterval={286}
            snapToAlignment="start"
          >
            {data.map((item: ServiceData) => (
              <View key={item.serviceId} style={{ width: 280, marginRight: 6 }}>
                <ServiceCard
                  imageUrl={item.imageUrl}
                  category={getCategoryLabel(item.category)}
                  title={item.serviceName}
                  description={item.description}
                  price={item.priceUsd}
                  duration={item.durationMinutes}
                  onPress={() => onServicePress(item)}
                  showFavoriteButton
                  serviceId={item.serviceId}
                  isFavorited={favoritedIds.has(item.serviceId)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View className="items-center py-10">
          <Text className="text-gray-400 text-center">
            No recently viewed services
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Browse services to see them here
          </Text>
        </View>
      )}
    </View>
  );
}
