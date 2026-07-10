import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonList } from "@/shared/components/ui/Skeleton";
import { useServiceReviews } from "../../feature-tab/hooks";
import {
  ReviewsHeader,
  RatingFilter,
  RatingSummary,
  ReviewCard,
  EmptyReviewsState,
} from "../../feature-tab/components";

export default function ServiceReviewsScreen() {
  const {
    reviews,
    stats,
    hasReviews,
    isShopOwner,
    currentUserAddress,
    ratingFilter,
    refreshing,
    isLoading,
    error,
    isFetchingNextPage,
    handleFilterChange,
    handleGoBack,
    onRefresh,
    refetch,
    loadMore,
  } = useServiceReviews();

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={["top"]}>
      <ReviewsHeader onBack={handleGoBack} />

      {isLoading && !refreshing ? (
        <View className="flex-1 px-4 pt-4">
          <SkeletonList count={5} variant="list" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-4">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text className="text-white text-lg mt-4">Failed to load reviews</Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 bg-[#FFCC00] px-6 py-3 rounded-full"
            activeOpacity={0.7}
          >
            <Text className="text-black font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          className="flex-1 mt-6"
          data={reviews}
          keyExtractor={(item) => item.reviewId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
          ListHeaderComponent={
            <>
              {/* Rating Summary */}
              {stats && stats.totalReviews > 0 && (
                <RatingSummary stats={stats} />
              )}

              {/* Rating Filter */}
              {hasReviews && (
                <View className="px-4 gap-4 mb-4">
                  <RatingFilter
                    selectedRating={ratingFilter}
                    onSelect={handleFilterChange}
                  />
                  <Text className="text-gray-400 text-sm">
                    {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              isShopOwner={isShopOwner}
              currentUserAddress={currentUserAddress}
              onReviewUpdated={refetch}
            />
          )}
          ListEmptyComponent={
            <EmptyReviewsState hasFilter={ratingFilter !== null} />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator size="small" color="#FFCC00" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
