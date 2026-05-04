import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceData } from "@/shared/interfaces/service.interface";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import { SkeletonHorizontalCards } from "@/shared/components/ui/Skeleton";

interface ServiceSectionProps {
  handleViewAllServices: () => void;
  servicesLoading: boolean;
  displayedServices: ServiceData[];
  handleServicePress: (item: ServiceData) => void;
  favoritedIds: Set<string>;
}

export default function ServiceSection({
  handleViewAllServices,
  servicesLoading,
  displayedServices,
  handleServicePress,
  favoritedIds,
}: ServiceSectionProps) {
  return (
    <View className="mt-5">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Ionicons name="grid" size={20} color="#FFCC00" />
          <Text className="text-white text-xl font-bold ml-2">Services</Text>
        </View>
        <TouchableOpacity onPress={handleViewAllServices}>
          <Text className="text-[#FFCC00] text-sm font-semibold">View All</Text>
        </TouchableOpacity>
      </View>
      {servicesLoading ? (
        <SkeletonHorizontalCards count={3} cardWidth={280} />
      ) : displayedServices.length > 0 ? (
        <View style={{ marginHorizontal: -16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            decelerationRate="fast"
            snapToInterval={286}
            snapToAlignment="start"
          >
            {displayedServices.map((item: ServiceData) => (
              <View key={item.serviceId} style={{ width: 280, marginRight: 6 }}>
                <ServiceCard
                  imageUrl={item.imageUrl}
                  category={item.category}
                  title={item.serviceName}
                  description={item.description}
                  price={item.priceUsd}
                  avgRating={item.avgRating}
                  reviewCount={item.reviewCount}
                  duration={item.durationMinutes}
                  onPress={() => handleServicePress(item)}
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
            No services available
          </Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Check back later for new services
          </Text>
        </View>
      )}
    </View>
  );
}
