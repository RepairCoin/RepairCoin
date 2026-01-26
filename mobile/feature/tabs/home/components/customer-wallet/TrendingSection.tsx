import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ServiceData } from "@/shared/interfaces/service.interface";
import ServiceCard from "@/components/shared/ServiceCard";

interface TrendingSectionProps {
  handleViewAllTrendingServices: () => void;
  trendingLoading: boolean;
  trendingData: ServiceData[] | undefined;
  getCategoryLabel: (category: string) => string;
  handleServicePress: (item: ServiceData) => void;
  favoritedIds: Set<string>;
}

export default function TrendingSection({
  handleViewAllTrendingServices,
  trendingLoading,
  trendingData,
  getCategoryLabel,
  handleServicePress,
  favoritedIds,
}: TrendingSectionProps) {
  return (
    <View className="mt-5">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="fire" size={22} color="#FF6B35" />
          <Text className="text-white text-xl font-bold ml-1">Trending</Text>
        </View>
        <TouchableOpacity onPress={handleViewAllTrendingServices}>
          <Text className="text-[#FFCC00] text-sm font-semibold">View All</Text>
        </TouchableOpacity>
      </View>

      {/* Trending Cards - Horizontal Slider */}
      {trendingLoading ? (
        <View className="justify-center items-center py-10">
          <ActivityIndicator size="large" color="#FFCC00" />
        </View>
      ) : trendingData && trendingData.length > 0 ? (
        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            decelerationRate="fast"
            snapToInterval={286}
            snapToAlignment="start"
          >
            {trendingData.map((item: ServiceData) => (
              <View key={item.serviceId} style={{ width: 280, marginRight: 6 }}>
                <ServiceCard
                  imageUrl={item.imageUrl}
                  category={getCategoryLabel(item.category)}
                  title={item.serviceName}
                  description={item.description}
                  price={item.priceUsd}
                  duration={item.durationMinutes}
                  onPress={() => handleServicePress(item)}
                  showTrendingBadge
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
            No trending services
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Check back later for trending services
          </Text>
        </View>
      )}
    </View>
  );
}
