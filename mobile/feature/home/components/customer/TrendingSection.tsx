import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ServiceData } from "@/feature/services/services/service.interface";
import { ServiceGridCard } from "@/shared/components/shared/ServiceGridCard";
import { SERVICE_GRID_ITEM_WIDTH } from "@/shared/components/shared/ServiceGridItem";
import { useToggleFavoriteMutation } from "@/feature/services/services-main/feature-tab/hooks/useFeatureTabQuery";
import { SkeletonHorizontalCards } from "@/shared/components/ui/Skeleton";

const CARD_SNAP_INTERVAL = SERVICE_GRID_ITEM_WIDTH + 8;

interface TrendingSectionProps {
  handleViewAllTrendingServices: () => void;
  trendingLoading: boolean;
  trendingData: ServiceData[] | undefined;
  handleServicePress: (item: ServiceData) => void;
  favoritedIds: Set<string>;
  title?: string;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}

export default function TrendingSection({
  handleViewAllTrendingServices,
  trendingLoading,
  trendingData,
  handleServicePress,
  favoritedIds,
  title = "Trending Services",
  iconName = "fire",
}: TrendingSectionProps) {
  // One favorite mutation for the whole carousel — NOT one per card.
  const { toggleFavorite } = useToggleFavoriteMutation();

  return (
    <View className="mt-5">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name={iconName} size={22} color="#FF6B35" />
          <Text className="text-white text-xl font-bold ml-1">{title}</Text>
        </View>
        <TouchableOpacity onPress={handleViewAllTrendingServices}>
          <Text className="text-[#FFCC00] text-sm font-semibold">See All</Text>
        </TouchableOpacity>
      </View>
      {trendingLoading ? (
        <SkeletonHorizontalCards count={3} cardWidth={SERVICE_GRID_ITEM_WIDTH} />
      ) : trendingData && trendingData.length > 0 ? (
        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
            decelerationRate="fast"
            snapToInterval={CARD_SNAP_INTERVAL}
            snapToAlignment="start"
          >
            {trendingData.map((item: ServiceData) => (
              <ServiceGridCard
                key={item.serviceId}
                service={item}
                isFavorited={favoritedIds.has(item.serviceId)}
                onPress={handleServicePress}
                onToggleFavorite={toggleFavorite}
              />
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
