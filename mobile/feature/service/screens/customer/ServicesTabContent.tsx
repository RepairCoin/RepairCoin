import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
  Dimensions,
} from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import ServiceCard from "@/shared/components/shared/ServiceCard";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { SkeletonServiceGrid } from "@/shared/components/ui/Skeleton";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { useServicesTab } from "../hooks";
import { ServiceFilterModal, FilterChip, ClearAllFilters } from "../components";
import { ServiceSortOption } from "../tab-types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 16) / 2;

// Sort option labels for display
const SORT_LABELS: Record<ServiceSortOption, string> = {
  default: "Default",
  price_low: "Price: Low to High",
  price_high: "Price: High to Low",
  duration_short: "Shortest Duration",
  duration_long: "Longest Duration",
  newest: "Newest First",
};

export default function ServicesTabContent() {
  const {
    filteredServices,
    totalResults,
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
    getCategoryLabel,
    sortOption,
    setSortOption,
    priceRange,
    setPriceRange,
    hasNextPage,
    isFetchingNextPage,
    handleLoadMore,
  } = useServicesTab();

  const renderServiceItem = ({ item }: { item: ServiceData }) => (
    <View style={{ width: CARD_WIDTH, marginHorizontal: 4, marginVertical: 8 }}>
      <ServiceCard
        imageUrl={item.imageUrl}
        category={getCategoryLabel(item.category)}
        title={item.serviceName}
        description={item.description}
        price={item.priceUsd}
        avgRating={item.avgRating}
        reviewCount={item.reviewCount}        duration={item.durationMinutes}
        onPress={() => handleServicePress(item)}
        showFavoriteButton
        serviceId={item.serviceId}
        isFavorited={favoritedIds.has(item.serviceId)}
      />
    </View>
  );

  return (
    <React.Fragment>
      {/* Search Input with Sort and Filter Buttons */}
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search services..."
          />
        </View>

        {/* Filter Button */}
        <Pressable
          onPress={openFilterModal}
          className={`p-3 rounded-full ${
            hasActiveFilters ? "bg-[#FFCC00]" : ""
          }`}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={hasActiveFilters ? "#000" : "#9CA3AF"}
          />
        </Pressable>
      </View>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {/* Sort chip */}
          {sortOption !== "default" && (
            <FilterChip
              label={SORT_LABELS[sortOption]}
              onRemove={() => setSortOption("default")}
            />
          )}
          {/* Price range chip */}
          {(priceRange.min !== null || priceRange.max !== null) && (
            <FilterChip
              label={
                priceRange.min !== null && priceRange.max !== null
                  ? `$${priceRange.min} - $${priceRange.max}`
                  : priceRange.min !== null
                  ? `$${priceRange.min}+`
                  : `Up to $${priceRange.max}`
              }
              onRemove={() => setPriceRange({ min: null, max: null })}
            />
          )}
          {/* Status chip */}
          {statusFilter !== "all" && (
            <FilterChip
              label={statusFilter}
              onRemove={() => setStatusFilter("all")}
            />
          )}
          {/* Category chips */}
          {selectedCategories.map((cat) => (
            <FilterChip
              key={cat}
              label={getCategoryLabel(cat)}
              onRemove={() => toggleCategory(cat)}
            />
          ))}
          <ClearAllFilters onPress={clearFilters} />
        </View>
      )}

      {/* Results count when searching or filtering */}
      {(searchQuery.length > 0 || hasActiveFilters) && (
        <Text className="text-gray-400 text-sm mb-2">
          {totalResults} result{totalResults !== 1 ? "s" : ""} found
        </Text>
      )}

      {isLoading && !servicesData ? (
        <SkeletonServiceGrid count={6} />
      ) : error ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500">Failed to load services</Text>
          <TouchableOpacity onPress={handleRefresh} className="mt-2">
            <Text className="text-[#FFCC00]">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.serviceId}
          renderItem={renderServiceItem}
          numColumns={2}
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
                {searchQuery.length > 0 || hasActiveFilters
                  ? "No services match your filters"
                  : "No services available"}
              </Text>
              <Text className="text-gray-500 text-sm text-center mt-2">
                {searchQuery.length > 0 || hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "Check back later for new services"}
              </Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
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
    </React.Fragment>
  );
}
