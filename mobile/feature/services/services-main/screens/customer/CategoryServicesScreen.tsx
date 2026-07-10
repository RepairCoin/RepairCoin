import React from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import GradientHeader from "@/shared/components/ui/GradientHeader";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { SkeletonServiceGrid } from "@/shared/components/ui/Skeleton";
import { ServiceData } from "@/feature/services/services/service.interface";
import { useServicesTab } from "../../feature-tab/hooks";
import { ServiceFilterModal } from "../../feature-tab/components";
import { getCategoryLabel } from "@/shared/utilities/getCategoryLabel";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 16) / 2;

/**
 * V2 "Per Industry Page": a category-scoped service listing
 * (e.g. Electronics & Gadgets). Reuses the shared services query via
 * useServicesTab seeded with the route's category, and the shared ServiceCard.
 */
export default function CategoryServicesScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();

  const {
    filteredServices,
    favoritedIds,
    isLoading,
    isFetching,
    error,
    servicesData,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    selectedCategories,
    toggleCategory,
    clearFilters,
    hasActiveFilters,
    filterModalVisible,
    openFilterModal,
    closeFilterModal,
    handleServicePress,
    handleRefresh,
    sortOption,
    setSortOption,
    priceRange,
    setPriceRange,
    hasNextPage,
    isFetchingNextPage,
    handleLoadMore,
  } = useServicesTab(category);

  const title = category ? getCategoryLabel(category) : "Services";

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <View style={{ width: CARD_WIDTH, marginHorizontal: 4, marginVertical: 8 }}>
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
        location={item.shopAddress}
        duration={item.durationMinutes}
        onPress={() => handleServicePress(item)}
        showFavoriteButton
        serviceId={item.serviceId}
        isFavorited={favoritedIds.has(item.serviceId)}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <GradientHeader className="pb-2">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <SearchInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search services or shop.."
            />
          </View>
          <Pressable
            onPress={openFilterModal}
            className={`p-2.5 rounded-xl ${hasActiveFilters ? "bg-[#FFCC00]" : ""}`}
          >
            <Ionicons
              name="menu"
              size={24}
              color={hasActiveFilters ? "#000" : "#fff"}
            />
          </Pressable>
        </View>
      </GradientHeader>
      <Text className="text-white text-2xl font-bold text-center mt-3 mb-1 px-4">
        {title}
      </Text>

      {isLoading && !servicesData ? (
        <View className="px-4">
          <SkeletonServiceGrid count={6} />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500">Failed to load services</Text>
          <Pressable onPress={handleRefresh} className="mt-2">
            <Text className="text-[#FFCC00]">Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.serviceId}
          renderItem={renderServiceItem}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          extraData={filteredServices.length}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={handleRefresh}
              tintColor="#FFCC00"
            />
          }
          ListFooterComponent={
            hasNextPage ? (
              <View className="py-4 items-center">
                {isFetchingNextPage ? (
                  <ActivityIndicator size="small" color="#FFCC00" />
                ) : (
                  <Pressable
                    onPress={handleLoadMore}
                    className="bg-zinc-800 px-6 py-3 rounded-full"
                  >
                    <Text className="text-[#FFCC00] font-semibold">Load More</Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pt-20">
              <Ionicons name="briefcase-outline" size={64} color="#666" />
              <Text className="text-gray-400 text-center mt-4">
                No services in {title} yet
              </Text>
            </View>
          }
        />
      )}

      <ServiceFilterModal
        visible={filterModalVisible}
        onClose={closeFilterModal}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        onClearFilters={clearFilters}
        sortOption={sortOption}
        onSortChange={setSortOption}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
      />
    </View>
  );
}
