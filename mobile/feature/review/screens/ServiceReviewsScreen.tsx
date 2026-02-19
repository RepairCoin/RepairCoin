import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useServiceReviews } from "../hooks";
import {
  ReviewsHeader,
  RatingFilter,
  RatingSummary,
  ReviewCard,
  EmptyReviewsState,
} from "../components";

export default function ServiceReviewsScreen() {
  const {
    reviews,
    stats,
    hasReviews,
    isShopOwner,
    ratingFilter,
    refreshing,
    isLoading,
    error,
    handleFilterChange,
    handleGoBack,
    onRefresh,
    refetch,
  } = useServiceReviews();

  return (
    <SafeAreaView className="flex-1 bg-zinc-950" edges={["top"]}>
      <ReviewsHeader onBack={handleGoBack} />

      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFCC00" />
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
        <ScrollView
          className="flex-1 mt-6"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFCC00"
              colors={["#FFCC00"]}
            />
          }
        >
          {/* Rating Summary */}
          {stats && stats.totalReviews > 0 && <RatingSummary stats={stats} />}

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

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <EmptyReviewsState hasFilter={ratingFilter !== null} />
          ) : (
            <View className="pb-6">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.reviewId}
                  review={review}
                  isShopOwner={isShopOwner}
                  onReviewUpdated={refetch}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
