import { View, Dimensions } from "react-native";
import ServiceCard from "./ServiceCard";
import { ServiceData } from "@/feature/services/services/service.interface";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 16px outer padding each side (32 total) + 4px marginHorizontal per card × 2 (16 total)
export const SERVICE_GRID_ITEM_WIDTH = (SCREEN_WIDTH - 32 - 16) / 2;

interface ServiceGridItemProps {
  service: ServiceData;
  onPress?: () => void;
  showFavoriteButton?: boolean;
  isFavorited?: boolean;
}

export function ServiceGridItem({
  service,
  onPress,
  showFavoriteButton = false,
  isFavorited = false,
}: ServiceGridItemProps) {
  return (
    <View
      style={{
        width: SERVICE_GRID_ITEM_WIDTH,
        marginHorizontal: 4,
        marginVertical: 8,
      }}
    >
      <ServiceCard
        imageUrl={service.imageUrl}
        category={service.category}
        title={service.serviceName}
        description={service.description}
        price={service.priceUsd}
        duration={service.durationMinutes}
        avgRating={service.avgRating}
        reviewCount={service.reviewCount}
        onPress={onPress}
        showFavoriteButton={showFavoriteButton}
        serviceId={service.serviceId}
        isFavorited={isFavorited}
      />
    </View>
  );
}
