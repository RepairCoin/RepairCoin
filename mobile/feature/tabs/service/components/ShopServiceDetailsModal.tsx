import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceData } from "@/shared/interfaces/service.interface";
import { ReviewData } from "@/shared/interfaces/review.interface";
import { serviceApi } from "@/shared/services/service.services";
import { Alert } from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ShopServiceDetailsModalProps {
  visible: boolean;
  service: ServiceData | null;
  onClose: () => void;
}

type TabType = "details" | "reviews";

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

function ReviewCard({
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
    <View className="bg-[#0d0d0d] rounded-xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-[#333] items-center justify-center mr-3">
          <Text className="text-white font-semibold text-sm">
            {getInitials(review.customerName, review.customerAddress)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-white font-medium text-sm" numberOfLines={1}>
            {review.customerName ||
              `${review.customerAddress.slice(0, 6)}...${review.customerAddress.slice(-4)}`}
          </Text>
          <View className="flex-row items-center mt-1">
            <StarDisplay rating={review.rating} size={12} />
            <Text className="text-gray-500 text-xs ml-2">
              {formatDate(review.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Comment */}
      {review.comment && (
        <TouchableOpacity
          onPress={() => shouldTruncate && setIsExpanded(!isExpanded)}
          activeOpacity={shouldTruncate ? 0.7 : 1}
          className="mb-3"
        >
          <Text
            className="text-gray-300 text-sm leading-5"
            numberOfLines={isExpanded ? undefined : 3}
          >
            {review.comment}
          </Text>
          {shouldTruncate && (
            <Text className="text-[#FFCC00] text-xs mt-1">
              {isExpanded ? "Show less" : "Read more"}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Shop Response */}
      {review.shopResponse ? (
        <View className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <View className="flex-row items-center mb-2">
            <Ionicons name="chatbubble" size={12} color="#60A5FA" />
            <Text className="text-blue-400 text-xs ml-1 font-medium">
              Your Response
            </Text>
          </View>
          <Text className="text-blue-200 text-sm">{review.shopResponse}</Text>
        </View>
      ) : isResponding ? (
        <View className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-3">
          <TextInput
            value={responseText}
            onChangeText={onResponseTextChange}
            placeholder="Write a response..."
            placeholderTextColor="#6B7280"
            multiline
            className="text-white text-sm min-h-[60px]"
            style={{ textAlignVertical: "top" }}
          />
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity
              onPress={onSubmitResponse}
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
              onPress={onCancelResponding}
              className="px-3 py-2 bg-gray-800 rounded-lg"
            >
              <Text className="text-white text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onStartResponding}
          className="flex-row items-center"
        >
          <Ionicons name="chatbubble-outline" size={14} color="#60A5FA" />
          <Text className="text-blue-400 text-xs ml-1">Respond</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ShopServiceDetailsModal({
  visible,
  service,
  onClose,
}: ShopServiceDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Reset state when modal closes or service changes
  useEffect(() => {
    if (!visible) {
      setActiveTab("details");
      setReviews([]);
      setReviewsLoaded(false);
      setRespondingTo(null);
      setResponseText("");
    }
  }, [visible]);

  const loadReviews = async () => {
    if (!service || reviewsLoaded) return;

    setReviewsLoading(true);
    try {
      const response = await serviceApi.getServiceReviews(service.serviceId, {
        limit: 50,
      });

      if (response?.data) {
        setReviews(response.data);
        setReviewsLoaded(true);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      Alert.alert("Error", "Failed to load reviews");
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "reviews" && !reviewsLoaded) {
      loadReviews();
    }
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim()) {
      Alert.alert("Error", "Please enter a response");
      return;
    }

    setSubmittingResponse(true);
    try {
      await serviceApi.addShopResponse(reviewId, responseText);
      Alert.alert("Success", "Response added successfully!");
      setRespondingTo(null);
      setResponseText("");
      // Reload reviews
      setReviewsLoaded(false);
      loadReviews();
    } catch (error) {
      console.error("Error adding response:", error);
      Alert.alert("Error", "Failed to add response");
    } finally {
      setSubmittingResponse(false);
    }
  };

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  if (!service) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80">
        <View
          className="flex-1 bg-[#1a1a1a] mt-12 rounded-t-3xl"
          style={{ maxHeight: SCREEN_HEIGHT - 48 }}
        >
          {/* Header */}
          <View className="border-b border-gray-800">
            <View className="flex-row items-center justify-between p-4">
              <Text className="text-white text-xl font-bold">Service Details</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="flex-row border-t border-gray-800">
              <TouchableOpacity
                onPress={() => handleTabChange("details")}
                className={`flex-1 py-3 items-center ${
                  activeTab === "details" ? "border-b-2 border-[#FFCC00]" : ""
                }`}
              >
                <Text
                  className={`font-semibold ${
                    activeTab === "details" ? "text-[#FFCC00]" : "text-gray-400"
                  }`}
                >
                  Details
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleTabChange("reviews")}
                className={`flex-1 py-3 items-center ${
                  activeTab === "reviews" ? "border-b-2 border-[#FFCC00]" : ""
                }`}
              >
                <Text
                  className={`font-semibold ${
                    activeTab === "reviews" ? "text-[#FFCC00]" : "text-gray-400"
                  }`}
                >
                  Reviews {reviews.length > 0 ? `(${reviews.length})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
            {/* Details Tab */}
            {activeTab === "details" && (
              <View>
                {/* Service Image */}
                {service.imageUrl && (
                  <View className="w-full h-48 rounded-xl overflow-hidden bg-gray-800 mb-4">
                    <Image
                      source={{ uri: service.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                )}

                {/* Service Info */}
                <View className="bg-[#0d0d0d] rounded-xl p-4">
                  <Text className="text-white text-xl font-bold mb-3">
                    {service.serviceName}
                  </Text>

                  {service.category && (
                    <View className="mb-4">
                      <View className="self-start bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-full px-3 py-1">
                        <Text className="text-[#FFCC00] text-sm">
                          {service.category}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View className="flex-row mb-4">
                    <View className="flex-row items-center flex-1">
                      <Ionicons name="cash-outline" size={20} color="#10B981" />
                      <View className="ml-2">
                        <Text className="text-gray-400 text-xs">Price</Text>
                        <Text className="text-green-500 text-lg font-bold">
                          ${service.priceUsd.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {service.durationMinutes && (
                      <View className="flex-row items-center flex-1">
                        <Ionicons name="time-outline" size={20} color="#60A5FA" />
                        <View className="ml-2">
                          <Text className="text-gray-400 text-xs">Duration</Text>
                          <Text className="text-white text-lg font-semibold">
                            {service.durationMinutes} min
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {service.description && (
                    <View className="mb-4">
                      <Text className="text-white font-semibold mb-2">Description</Text>
                      <Text className="text-gray-400 text-sm leading-5">
                        {service.description}
                      </Text>
                    </View>
                  )}

                  {/* Tags */}
                  {service.tags && service.tags.length > 0 && (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Ionicons name="pricetags-outline" size={14} color="#fff" />
                        <Text className="text-white font-semibold ml-2">Tags</Text>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {service.tags.map((tag, index) => (
                          <View
                            key={index}
                            className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-full px-3 py-1"
                          >
                            <Text className="text-[#FFCC00] text-xs">{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Status */}
                  <View className="pt-4 border-t border-gray-800">
                    {service.active ? (
                      <View className="self-start bg-green-500/20 border border-green-500/30 rounded-full px-3 py-1">
                        <Text className="text-green-400 text-xs font-semibold">
                          Active
                        </Text>
                      </View>
                    ) : (
                      <View className="self-start bg-gray-500/20 border border-gray-500/30 rounded-full px-3 py-1">
                        <Text className="text-gray-400 text-xs font-semibold">
                          Inactive
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <View>
                {reviewsLoading ? (
                  <View className="items-center justify-center py-12">
                    <ActivityIndicator size="large" color="#FFCC00" />
                    <Text className="text-white mt-4">Loading reviews...</Text>
                  </View>
                ) : reviews.length === 0 ? (
                  <View className="bg-[#0d0d0d] rounded-xl p-8 items-center">
                    <Text className="text-4xl mb-3">⭐</Text>
                    <Text className="text-white text-lg font-semibold mb-1">
                      No Reviews Yet
                    </Text>
                    <Text className="text-gray-400 text-sm text-center">
                      This service hasn't received any reviews from customers yet
                    </Text>
                  </View>
                ) : (
                  <View>
                    {/* Summary */}
                    <View className="bg-[#0d0d0d] rounded-xl p-4 mb-4">
                      <View className="flex-row items-center">
                        <View className="items-center mr-4">
                          <Text className="text-white text-3xl font-bold">
                            {averageRating}
                          </Text>
                          <StarDisplay rating={parseFloat(averageRating)} size={12} />
                          <Text className="text-gray-500 text-xs mt-1">
                            {reviews.length} reviews
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-gray-400 text-sm">
                            {reviews.filter((r) => r.shopResponse).length} of{" "}
                            {reviews.length} reviews have been responded to
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Reviews List */}
                    {reviews.map((review) => (
                      <ReviewCard
                        key={review.reviewId}
                        review={review}
                        isResponding={respondingTo === review.reviewId}
                        responseText={
                          respondingTo === review.reviewId ? responseText : ""
                        }
                        isSubmitting={submittingResponse}
                        onStartResponding={() => {
                          setRespondingTo(review.reviewId);
                          setResponseText("");
                        }}
                        onCancelResponding={() => {
                          setRespondingTo(null);
                          setResponseText("");
                        }}
                        onResponseTextChange={setResponseText}
                        onSubmitResponse={() => handleSubmitResponse(review.reviewId)}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Bottom padding */}
            <View className="h-8" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
