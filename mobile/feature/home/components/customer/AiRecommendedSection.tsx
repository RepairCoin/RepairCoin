import React from "react";
import { View, Text, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ServiceData } from "@/feature/services/services/service.interface";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import SectionHeader from "@/shared/components/ui/SectionHeader";
import { SkeletonHorizontalCards } from "@/shared/components/ui/Skeleton";

interface AiRecommendedSectionProps {
  data: ServiceData[] | undefined;
  isLoading: boolean;
  onServicePress: (item: ServiceData) => void;
  onSeeAll: () => void;
  favoritedIds: Set<string>;
}

/**
 * V2 "AI Recommended For You" carousel. Currently sourced from the services
 * feed as a placeholder; swap `data` for a real recommendation endpoint later.
 */
export default function AiRecommendedSection({
  data,
  isLoading,
  onServicePress,
  onSeeAll,
  favoritedIds,
}: AiRecommendedSectionProps) {
  return (
    <View>
      <SectionHeader
        title="AI Recommended For You"
        icon={
          <MaterialCommunityIcons
            name="star-four-points"
            size={16}
            color="#000"
          />
        }
        onSeeAll={onSeeAll}
      />
      {isLoading ? (
        <SkeletonHorizontalCards count={3} cardWidth={280} />
      ) : data && data.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          style={{ marginHorizontal: -16 }}
          decelerationRate="fast"
          snapToInterval={286}
          snapToAlignment="start"
        >
          {data.map((item: ServiceData) => (
            <View key={item.serviceId} style={{ width: 280, marginRight: 6 }}>
              <ServiceCard
                imageUrl={item.imageUrl}
                category={item.category}
                shopName={item.shopName}
                title={item.serviceName}
                description={item.description}
                price={item.priceUsd}
                avgRating={item.avgRating}
                reviewCount={item.reviewCount}
                bookingCount={item.reviewCount}
                duration={item.durationMinutes}
                onPress={() => onServicePress(item)}
                showFavoriteButton
                serviceId={item.serviceId}
                isFavorited={favoritedIds.has(item.serviceId)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="items-center py-8">
          <Text className="text-gray-500 text-sm">
            No recommendations yet
          </Text>
        </View>
      )}
    </View>
  );
}
