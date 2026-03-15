import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReviewData, ReviewStats } from "@/shared/interfaces/review.interface";
import { serviceApi } from "@/shared/services/service.services";

interface UnifiedReviewsSectionProps {
  reviews: ReviewData[];
  stats: ReviewStats | null;
  isLoading: boolean;
  isShopOwner?: boolean;
  onSeeAll: () => void;
  onReviewUpdated?: () => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={14}
          color={star <= rating ? "#FFCC00" : "#4B5563"}
        />
      ))}
    </View>
  );
}

function ReviewImage({ uri }: { uri: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View className="w-16 h-16 rounded-lg bg-zinc-800 items-center justify-center">
        <Ionicons name="image-outline" size={20} color="#6B7280" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className="w-16 h-16 rounded-lg"
      resizeMode="cover"
      onError={() => setHasError(true)}
    />
  );
}

function ReviewCard({
  review,
  isShopOwner = false,
  onReviewUpdated,
}: {
  review: ReviewData;
  isShopOwner?: boolean;
  onReviewUpdated?: () => void;
}) {
  const [isResponding, setIsResponding] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (name: string | null, address: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return address.slice(2, 4).toUpperCase();
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      Alert.alert("Error", "Please enter a response");
      return;
    }

    setIsSubmitting(true);
    try {
      await serviceApi.addShopResponse(review.reviewId, responseText);
      Alert.alert("Success", "Response added successfully!");
      setIsResponding(false);
      setResponseText("");
      onReviewUpdated?.();
    } catch (error) {
      console.error("Error adding response:", error);
      Alert.alert("Error", "Failed to add response");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-[#333] items-center justify-center mr-3">
          <Text className="text-white font-semibold text-sm">
            {getInitials(review.customerName, review.customerAddress)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-medium" numberOfLines={1}>
            {review.customerName ||
              `${review.customerAddress.slice(0, 6)}...${review.customerAddress.slice(-4)}`}
          </Text>
          <View className="flex-row items-center mt-1">
            <StarRating rating={review.rating} />
            <Text className="text-gray-500 text-xs ml-2">
              {formatDate(review.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Comment */}
      {review.comment && (
        <Text className="text-gray-300 text-sm leading-5 mb-3" numberOfLines={3}>
          {review.comment}
        </Text>
      )}

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <View className="flex-row mb-3 gap-2">
          {review.images.slice(0, 3).map((image, index) => (
            <ReviewImage key={index} uri={image} />
          ))}
          {review.images.length > 3 && (
            <View className="w-16 h-16 rounded-lg bg-[#333] items-center justify-center">
              <Text className="text-white font-medium">
                +{review.images.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Shop Response */}
      {review.shopResponse ? (
        <View
          className={`mt-3 rounded-lg p-3 ${
            isShopOwner
              ? "bg-blue-500/10 border border-blue-500/30"
              : "bg-[#252525]"
          }`}
        >
          <View className="flex-row items-center mb-2">
            <Ionicons
              name={isShopOwner ? "chatbubble" : "storefront-outline"}
              size={isShopOwner ? 12 : 14}
              color={isShopOwner ? "#60A5FA" : "#9CA3AF"}
            />
            <Text
              className={`text-xs ml-1 font-medium ${
                isShopOwner ? "text-blue-400" : "text-gray-400"
              }`}
            >
              {isShopOwner ? "Your Response" : "Shop Response"}
            </Text>
          </View>
          <Text
            className={`text-sm ${isShopOwner ? "text-blue-200" : "text-gray-300"}`}
            numberOfLines={2}
          >
            {review.shopResponse}
          </Text>
        </View>
      ) : isShopOwner && isResponding ? (
        <View className="mt-3 bg-[#0d0d0d] border border-gray-700 rounded-lg p-3">
          <TextInput
            value={responseText}
            onChangeText={setResponseText}
            placeholder="Write a response..."
            placeholderTextColor="#6B7280"
            multiline
            className="text-white text-sm min-h-[60px]"
            style={{ textAlignVertical: "top" }}
          />
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity
              onPress={handleSubmitResponse}
              disabled={isSubmitting || !responseText.trim()}
              className={`flex-1 bg-[#FFCC00] rounded-lg py-2 items-center ${
                isSubmitting || !responseText.trim() ? "opacity-50" : ""
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text className="text-black font-semibold text-sm">Submit</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setIsResponding(false);
                setResponseText("");
              }}
              className="px-3 py-2 bg-gray-800 rounded-lg"
            >
              <Text className="text-white text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isShopOwner ? (
        <TouchableOpacity
          onPress={() => setIsResponding(true)}
          className="mt-3 flex-row items-center"
        >
          <Ionicons name="chatbubble-outline" size={14} color="#60A5FA" />
          <Text className="text-blue-400 text-xs ml-1">Respond</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function RatingSummary({ stats }: { stats: ReviewStats }) {
  return (
    <View className="flex-row items-center mb-4">
      <View className="items-center mr-4">
        <Text className="text-white text-3xl font-bold">
          {stats.averageRating.toFixed(1)}
        </Text>
        <View className="flex-row mt-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= Math.round(stats.averageRating) ? "star" : "star-outline"}
              size={12}
              color={star <= Math.round(stats.averageRating) ? "#FFCC00" : "#4B5563"}
            />
          ))}
        </View>
        <Text className="text-gray-500 text-xs mt-1">
          {stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}
        </Text>
      </View>

      {/* Rating bars */}
      <View className="flex-1">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count =
            stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution] || 0;
          const percentage =
            stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
          return (
            <View key={rating} className="flex-row items-center mb-1">
              <Text className="text-gray-500 text-xs w-4">{rating}</Text>
              <View className="flex-1 h-2 bg-[#333] rounded-full mx-2">
                <View
                  className="h-full bg-[#FFCC00] rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </View>
              <Text className="text-gray-500 text-xs w-6">{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function UnifiedReviewsSection({
  reviews,
  stats,
  isLoading,
  isShopOwner = false,
  onSeeAll,
  onReviewUpdated,
}: UnifiedReviewsSectionProps) {
  const hasReviews = reviews.length > 0;
  
  return (
    <View className="mb-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold ml-2">
            Customer Reviews
            {hasReviews && (
              <Text className="text-gray-400"> ({reviews.length})</Text>
            )}
          </Text>

          {/* Average Rating Display */}
          {stats && stats.totalReviews > 0 && (
            <View className="flex-row items-center ml-2 mt-1">
              <View className="flex-row items-center">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= Math.floor(stats.averageRating);
                  const partial = !filled && star - stats.averageRating < 1 && star - stats.averageRating > 0;
                  return (
                    <Ionicons
                      key={star}
                      name={filled || partial ? "star" : "star-outline"}
                      size={14}
                      color={filled || partial ? "#FFCC00" : "#4B5563"}
                    />
                  );
                })}
              </View>
              <Text className="text-white text-sm font-semibold ml-1.5">
                {stats.averageRating.toFixed(1)}
              </Text>
              <Text className="text-gray-500 text-xs ml-1">
                ({stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"})
              </Text>
            </View>
          )}
        </View>

        {hasReviews && (
          <TouchableOpacity
            onPress={onSeeAll}
            className="flex-row items-center"
            activeOpacity={0.7}
          >
            <Text className="text-[#FFCC00] text-sm font-medium mr-1">See All</Text>
            <Ionicons name="chevron-forward" size={16} color="#FFCC00" />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="bg-[#1a1a1a] rounded-xl p-4">
          <View className="animate-pulse">
            <View className="h-4 bg-[#333] rounded w-3/4 mb-3" />
            <View className="h-3 bg-[#333] rounded w-1/2" />
          </View>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && !hasReviews && (
        <View className="bg-[#1a1a1a] rounded-xl p-6 items-center">
          <Ionicons name="chatbubble-ellipses-outline" size={40} color="#4B5563" />
          <Text className="text-gray-400 text-base mt-3 font-medium">
            No reviews yet
          </Text>
          <Text className="text-gray-500 text-sm mt-1 text-center">
            {isShopOwner
              ? "Reviews will appear here when customers leave feedback"
              : "Be the first to share your experience!"}
          </Text>
        </View>
      )}

      {/* Reviews Content */}
      {!isLoading && hasReviews && (
        <View>
          {/* Rating Summary */}
          {/* {stats && <RatingSummary stats={stats} />} */}

          {/* Review Cards - Show max 2 */}
          {reviews.slice(0, 2).map((review) => (
            <ReviewCard
              key={review.reviewId}
              review={review}
              isShopOwner={isShopOwner}
              onReviewUpdated={onReviewUpdated}
            />
          ))}

          {/* See More Button (if more than 2 reviews) */}
          {stats && stats.totalReviews > 2 && (
            <TouchableOpacity
              onPress={onSeeAll}
              className="bg-[#1a1a1a] rounded-xl p-4 flex-row items-center justify-center"
              activeOpacity={0.7}
            >
              <Text className="text-[#FFCC00] font-medium mr-2">
                View all {stats.totalReviews} reviews
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFCC00" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
