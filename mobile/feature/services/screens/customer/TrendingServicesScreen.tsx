import { View, Text, FlatList, RefreshControl, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { SkeletonServiceGrid } from "@/shared/components/ui/Skeleton";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { useTrendingServices } from "../../hooks";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 16) / 2;

export default function TrendingServicesScreen() {
  const {
    trendingServices,
    isLoading,
    refreshing,
    onRefresh,
    getCategoryLabel,
    handleServicePress,
  } = useTrendingServices();

  const renderServiceCard = ({ item }: { item: ServiceData }) => (
    <View style={{ width: CARD_WIDTH, marginHorizontal: 4, marginVertical: 8 }}>
      <ServiceCard
        imageUrl={item.imageUrl}
        category={getCategoryLabel(item.category)}
        title={item.serviceName}
        description={item.description}
        price={item.priceUsd}
        avgRating={item.avgRating}
        reviewCount={item.reviewCount}
        duration={item.durationMinutes}
        onPress={() => handleServicePress(item)}
        showTrendingBadge
      />
    </View>
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
      <View className="flex-1 bg-zinc-950">
        <AppHeader title="Trending Services" />
        <SkeletonServiceGrid count={6} />
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
