import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ReviewData } from "@/shared/interfaces/review.interface";
import { serviceApi } from "@/shared/services/service.services";

interface ReviewCardProps {
  review: ReviewData;
  isShopOwner?: boolean;
  onReviewUpdated?: () => void;
}

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

function ReviewImage({ uri }: { uri: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <View className="w-20 h-20 rounded-lg bg-zinc-800 items-center justify-center">
        <Ionicons name="image-outline" size={24} color="#6B7280" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className="w-20 h-20 rounded-lg"
      resizeMode="cover"
      onError={() => setHasError(true)}
    />
  );
}

export default function ReviewCard({ review, isShopOwner = false, onReviewUpdated }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <View className="bg-[#1a1a1a] rounded-xl p-4 mx-4 mb-3">
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

      {/* Comment */}
      {review.comment && (
        <TouchableOpacity
          onPress={() => shouldTruncate && setIsExpanded(!isExpanded)}
          activeOpacity={shouldTruncate ? 0.7 : 1}
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
          className="mt-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {review.images.map((image, index) => (
            <ReviewImage key={index} uri={image} />
          ))}
        </ScrollView>
      )}

      {/* Shop Response */}
      {review.shopResponse ? (
        <View className="mt-3 bg-[#252525] rounded-lg p-3">
          <View className="flex-row items-center mb-2">
            <Ionicons name="storefront-outline" size={14} color={isShopOwner ? "#60A5FA" : "#FFCC00"} />
            <Text className={`text-xs ml-1 font-medium ${isShopOwner ? "text-blue-400" : "text-[#FFCC00]"}`}>
              {isShopOwner ? "Your Response" : "Shop Response"}
            </Text>
            {review.shopResponseAt && (
              <Text className="text-gray-500 text-xs ml-2">
                {formatDate(review.shopResponseAt)}
              </Text>
            )}
          </View>
          <Text className="text-gray-300 text-sm">{review.shopResponse}</Text>
        </View>
      ) : isShopOwner && isResponding ? (
        <View className="mt-3 bg-[#0d0d0d] border border-gray-700 rounded-lg p-3">
          <TextInput
            value={responseText}
            onChangeText={setResponseText}
            placeholder="Write a response to this review..."
            placeholderTextColor="#6B7280"
            multiline
            className="text-white text-sm min-h-[80px]"
            style={{ textAlignVertical: "top" }}
          />
          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={handleSubmitResponse}
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
              onPress={() => {
                setIsResponding(false);
                setResponseText("");
              }}
              className="px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg"
            >
              <Text className="text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isShopOwner ? (
        <TouchableOpacity
          onPress={() => setIsResponding(true)}
          className="mt-3 flex-row items-center"
        >
          <Ionicons name="chatbubble-outline" size={16} color="#60A5FA" />
          <Text className="text-blue-400 text-sm ml-2">Respond to this review</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
