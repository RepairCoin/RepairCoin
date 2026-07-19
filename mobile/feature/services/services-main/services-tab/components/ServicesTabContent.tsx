import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import React, { useCallback, useEffect, useRef } from "react";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ServiceGridCard } from "@/shared/components/shared/ServiceGridCard";
import { SearchInput } from "@/shared/components/ui/SearchInput";
import { SkeletonServiceGrid } from "@/shared/components/ui/Skeleton";
import { ThemedText } from "@/shared/components/ui/ThemedText";
import { useTheme } from "@/shared/hooks/theme/useTheme";
import { useToggleFavoriteMutation } from "../../feature-tab/hooks/useFeatureTabQuery";
import { useServicesTab } from "../../feature-tab/hooks";
import { ServiceFilterModal, FilterChip, ClearAllFilters } from "../../feature-tab/components";
import { ServiceData, ServiceSortOption } from "@/feature/services/services/service.interface";

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
  // A category opened from the home grid arrives as a route param so the list
  // lands pre-filtered on that category.
  const { category } = useLocalSearchParams<{ category?: string }>();

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
    setCategoryFilter,
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
    isFetchingNextPage,
    handleLoadMore,
  } = useServicesTab(category);

  // The service screen is reused across tab navigation (router.navigate), so the
  // hook's initial state won't re-run when a new category param arrives — sync it.
  useEffect(() => {
    if (category) setCategoryFilter(category);
  }, [category, setCategoryFilter]);

  const { useThemeColor } = useTheme();
  const { theme } = useThemeColor();

  // One favorite mutation for the whole list — NOT one per card.
  const { toggleFavorite } = useToggleFavoriteMutation();

  // Stable render/key callbacks so cells don't remount on every parent render.
  const renderServiceItem = useCallback(
    ({ item }: { item: ServiceData }) => (
      <ServiceGridCard
        service={item}
        isFavorited={favoritedIds.has(item.serviceId)}
        onPress={handleServicePress}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [handleServicePress, favoritedIds, toggleFavorite]
  );

  const keyExtractor = useCallback((item: ServiceData) => item.serviceId, []);

  // Guard onEndReached against a recursive multi-fetch loop: it fires on mount
  // and repeatedly whenever the loaded rows don't fill the viewport (client-side
  // filters can shrink a page), which would fetch every page in a tight loop.
  // Allow exactly one load per user scroll gesture.
  const canLoadMore = useRef(false);
  const handleScrollBeginDrag = useCallback(() => {
    canLoadMore.current = true;
  }, []);
  const handleEndReached = useCallback(() => {
    if (!canLoadMore.current) return;
    canLoadMore.current = false;
    handleLoadMore();
  }, [handleLoadMore]);

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
          style={hasActiveFilters ? { backgroundColor: theme.tint } : undefined}
          className="p-3 rounded-full"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={hasActiveFilters ? theme.textInverted : theme.icon}
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
        <ThemedText type="subtext" className="mb-2">
          {totalResults} result{totalResults !== 1 ? "s" : ""} found
        </ThemedText>
      )}

      {isLoading && !servicesData ? (
        <SkeletonServiceGrid count={6} />
      ) : error ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500">Failed to load services</Text>
          <TouchableOpacity onPress={handleRefresh} className="mt-2">
            <Text style={{ color: theme.tint }} className="font-semibold">
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredServices}
          keyExtractor={keyExtractor}
          renderItem={renderServiceItem}
          numColumns={2}
          extraData={favoritedIds}
          // flex:1 gives the list a bounded height so it becomes the scroller —
          // without it onEndReached never fires and infinite scroll won't work.
          // (NativeWind className="flex-1" does not reliably apply here — use style.)
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          // Android clips rows first mounted off-screen (as appended pages are),
          // leaving blank space where the card should be — disable that here.
          removeClippedSubviews={false}
          // Bound the render window so long lists don't grow memory unboundedly.
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          onScrollBeginDrag={handleScrollBeginDrag}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isFetchingNextPage}
              onRefresh={handleRefresh}
              tintColor={theme.tint}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={theme.tint} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center pt-20">
              <Ionicons name="briefcase-outline" size={64} color={theme.icon} />
              <ThemedText className="text-center mt-4">
                {searchQuery.length > 0 || hasActiveFilters
                  ? "No services match your filters"
                  : "No services available"}
              </ThemedText>
              <ThemedText type="subtext" className="text-center mt-2">
                {searchQuery.length > 0 || hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "Check back later for new services"}
              </ThemedText>
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
