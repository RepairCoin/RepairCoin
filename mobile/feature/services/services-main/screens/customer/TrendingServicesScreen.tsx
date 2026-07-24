import { View, Text, FlatList, RefreshControl, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import SponsoredAdCard from "@/shared/components/shared/SponsoredAdCard";
import { AppHeader } from "@/shared/components/ui/AppHeader";
import { SkeletonServiceGrid } from "@/shared/components/ui/Skeleton";
import { ServiceData } from "@/feature/services/services/service.interface";
import { useTrendingServices } from "../../feature-tab/hooks";
import { ServiceGridRow } from "../../feature-tab/utils/buildAdRows";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 16) / 2;

export default function TrendingServicesScreen() {
  const {
    rows,
    isLoading,
    refreshing,
    onRefresh,
    getCategoryLabel,
    handleServicePress,
    handleAdPress,
  } = useTrendingServices();

  const renderServiceCard = (item: ServiceData) => (
    <View
      key={item.serviceId}
      style={{ width: CARD_WIDTH, marginHorizontal: 4, marginVertical: 8 }}
    >
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

  // Rows are pre-chunked (see buildAdRows) instead of using numColumns, because a sponsored
  // card spans both columns and numColumns forces every item to the same width.
  const renderRow = ({ item }: { item: ServiceGridRow }) => {
    if (item.kind === "ad") {
      return (
        <View style={{ marginHorizontal: 4, marginVertical: 8 }}>
          <SponsoredAdCard ad={item.ad} onPress={() => handleAdPress(item.ad)} />
        </View>
      );
    }
    return <View className="flex-row">{item.items.map(renderServiceCard)}</View>;
  };

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

      {/* Services List — service rows with sponsored cards interleaved */}
      <FlatList
        data={rows}
        renderItem={renderRow}
        keyExtractor={(row) => row.key}
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
