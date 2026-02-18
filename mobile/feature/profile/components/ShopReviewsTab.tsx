import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useShopReviews } from "@/feature/review/hooks";
import { ReviewData } from "@/shared/interfaces/review.interface";

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={size}
          color={star <= rating ? "#FFCC00" : "#4B5563"}
        />
      ))}
    </View>
  );
}

function StatCard({
  icon,
  iconColor,
  bgColor,
  label,
  value,
  subtext,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4 flex-1">
      <View className="flex-row items-center">
        <View className={`p-2 rounded-lg ${bgColor}`}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View className="ml-3">
          <Text className="text-gray-400 text-xs">{label}</Text>
          <Text className="text-white text-xl font-bold">{value}</Text>
          <Text className="text-gray-500 text-xs">{subtext}</Text>
        </View>
      </View>
    </View>
  );
}

function RatingDistribution({
  ratingCounts,
  ratingFilter,
  onFilterChange,
}: {
  ratingCounts: Array<{ rating: number; count: number; percentage: number }>;
  ratingFilter: number | null;
  onFilterChange: (rating: number | null) => void;
}) {
  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4">
      <View className="flex-row items-center mb-4">
        <Ionicons name="funnel-outline" size={16} color="#fff" />
        <Text className="text-white font-semibold ml-2">Rating Distribution</Text>
      </View>
      {ratingCounts.map(({ rating, count, percentage }) => (
        <TouchableOpacity
          key={rating}
          onPress={() => onFilterChange(rating)}
          className={`flex-row items-center py-2 px-2 rounded-lg mb-1 ${
            ratingFilter === rating ? "bg-[#FFCC00]/10 border border-[#FFCC00]/30" : ""
          }`}
        >
          <View className="flex-row items-center w-12">
            <Text className="text-white font-semibold mr-1">{rating}</Text>
            <Ionicons name="star" size={12} color="#FFCC00" />
          </View>
          <View className="flex-1 h-2 bg-gray-800 rounded-full mx-2 overflow-hidden">
            <View
              className="h-full bg-[#FFCC00] rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </View>
          <Text className="text-gray-400 text-xs w-16 text-right">
            {count} ({percentage}%)
          </Text>
        </TouchableOpacity>
      ))}
      {ratingFilter !== null && (
        <TouchableOpacity
          onPress={() => onFilterChange(null)}
          className="mt-2"
        >
          <Text className="text-[#FFCC00] text-sm">Clear filter</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ShopReviewCard({
  review,
  isResponding,
  responseText,
  isSubmitting,
  onStartResponding,
  onCancelResponding,
  onResponseTextChange,
  onSubmitResponse,
}: {
  review: ReviewData;
  isResponding: boolean;
  responseText: string;
  isSubmitting: boolean;
  onStartResponding: () => void;
  onCancelResponding: () => void;
  onResponseTextChange: (text: string) => void;
  onSubmitResponse: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const shouldTruncate = review.comment && review.comment.length > 150;

  return (
    <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View className="w-11 h-11 rounded-full bg-[#333] items-center justify-center mr-3">
          <Text className="text-white font-semibold">
            {getInitials(review.customerName, review.customerAddress)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-medium" numberOfLines={1}>
            {review.customerName ||
              `${review.customerAddress.slice(0, 6)}...${review.customerAddress.slice(-4)}`}
          </Text>
          <View className="flex-row items-center mt-1">
            <StarDisplay rating={review.rating} />
            <Text className="text-gray-500 text-xs ml-2">
              {formatDate(review.createdAt)}
            </Text>
          </View>
        </View>
        {review.helpfulCount > 0 && (
          <View className="flex-row items-center bg-[#252525] rounded-full px-2 py-1">
            <Ionicons name="thumbs-up" size={12} color="#9CA3AF" />
            <Text className="text-gray-400 text-xs ml-1">
              {review.helpfulCount}
            </Text>
          </View>
        )}
      </View>

      {/* Service Name */}
      {review.serviceName && (
        <View className="mb-2">
          <Text className="text-gray-400 text-xs">
            Service: <Text className="text-white font-medium">{review.serviceName}</Text>
          </Text>
        </View>
      )}

      {/* Comment */}
      {review.comment && (
        <TouchableOpacity
          onPress={() => shouldTruncate && setIsExpanded(!isExpanded)}
          activeOpacity={shouldTruncate ? 0.7 : 1}
          className="bg-[#0d0d0d] rounded-lg p-3 mb-3"
        >
          <Text
            className="text-gray-300 text-sm leading-5"
            numberOfLines={isExpanded ? undefined : 4}
          >
            {review.comment}
          </Text>
          {shouldTruncate && (
            <Text className="text-[#FFCC00] text-sm mt-1">
              {isExpanded ? "Show less" : "Read more"}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {review.images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              className="w-20 h-20 rounded-lg"
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* Shop Response */}
      {review.shopResponse ? (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <View className="flex-row items-center mb-2">
            <Ionicons name="chatbubble" size={14} color="#60A5FA" />
            <Text className="text-blue-400 text-xs ml-1 font-medium">
              Your Response
            </Text>
            {review.shopResponseAt && (
              <Text className="text-gray-500 text-xs ml-2">
                {formatDate(review.shopResponseAt)}
              </Text>
            )}
          </View>
          <Text className="text-blue-200 text-sm">{review.shopResponse}</Text>
        </View>
      ) : isResponding ? (
        <View className="bg-[#0d0d0d] border border-gray-700 rounded-lg p-3">
          <TextInput
            value={responseText}
            onChangeText={onResponseTextChange}
            placeholder="Write a response to this review..."
            placeholderTextColor="#6B7280"
            multiline
            className="text-white text-sm min-h-[80px]"
            style={{ textAlignVertical: "top" }}
          />
          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={onSubmitResponse}
              disabled={isSubmitting || !responseText.trim()}
              className={`flex-1 bg-[#FFCC00] rounded-lg py-3 items-center ${
                isSubmitting || !responseText.trim() ? "opacity-50" : ""
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text className="text-black font-semibold">Submit Response</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCancelResponding}
              className="px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg"
            >
              <Text className="text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onStartResponding}
          className="flex-row items-center"
        >
          <Ionicons name="chatbubble-outline" size={16} color="#60A5FA" />
          <Text className="text-blue-400 text-sm ml-2">Respond to this review</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ShopReviewsTab() {
  const {
    reviews,
    hasReviews,
    totalReviews,
    averageRating,
    responseRate,
    ratingCounts,
    respondedCount,
    ratingFilter,
    refreshing,
    isLoading,
    respondingTo,
    responseText,
    isSubmittingResponse,
    handleFilterChange,
    onRefresh,
    setResponseText,
    handleSubmitResponse,
    handleStartResponding,
    handleCancelResponding,
  } = useShopReviews();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color="#FFCC00" />
        <Text className="text-white mt-4">Loading reviews...</Text>
      </View>
    );
  }

  if (!hasReviews && ratingFilter === null) {
    return (
      <View className="px-4">
        <View className="items-center justify-center py-12">
          <Ionicons name="star-outline" size={48} color="#666" />
          <Text className="text-gray-400 text-lg mt-4">No reviews yet</Text>
          <Text className="text-gray-500 text-sm mt-1 text-center">
            Your customers will be able to leave reviews after completing services
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 px-4"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FFCC00"
        />
      }
    >
      {/* Header */}
      <View className="mb-4">
        <Text className="text-white text-2xl font-bold">Customer Reviews</Text>
        <Text className="text-gray-400 text-sm mt-1">
          See what customers are saying about your services
        </Text>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-4">
        <StatCard
          icon="star"
          iconColor="#FFCC00"
          bgColor="bg-[#FFCC00]/20"
          label="Average Rating"
          value={averageRating}
          subtext={`${totalReviews} reviews`}
        />
        <StatCard
          icon="chatbubbles"
          iconColor="#10B981"
          bgColor="bg-green-500/20"
          label="Response Rate"
          value={`${responseRate}%`}
          subtext={`${respondedCount} responded`}
        />
      </View>

      {/* Rating Distribution */}
      <View className="mb-4">
        <RatingDistribution
          ratingCounts={ratingCounts}
          ratingFilter={ratingFilter}
          onFilterChange={handleFilterChange}
        />
      </View>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <View className="bg-[#1a1a1a] rounded-xl p-8 items-center">
          <Text className="text-4xl mb-3">⭐</Text>
          <Text className="text-white text-lg font-semibold mb-1">
            No Reviews With This Rating
          </Text>
          <Text className="text-gray-400 text-sm text-center mb-4">
            Try selecting a different rating
          </Text>
          <TouchableOpacity
            onPress={() => handleFilterChange(null)}
            className="bg-[#FFCC00] px-4 py-2 rounded-lg"
          >
            <Text className="text-black font-semibold">Clear Filter</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="pb-8">
          {reviews.map((review: ReviewData) => (
            <ShopReviewCard
              key={review.reviewId}
              review={review}
              isResponding={respondingTo === review.reviewId}
              responseText={respondingTo === review.reviewId ? responseText : ""}
              isSubmitting={isSubmittingResponse}
              onStartResponding={() => handleStartResponding(review.reviewId)}
              onCancelResponding={handleCancelResponding}
              onResponseTextChange={setResponseText}
              onSubmitResponse={() => handleSubmitResponse(review.reviewId)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
