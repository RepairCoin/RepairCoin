import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useMutation } from "@tanstack/react-query";
import apiClient from "@/utilities/axios";

export default function WriteReview() {
  const { orderId, serviceId, serviceName, shopName } = useLocalSearchParams<{
    orderId: string;
    serviceId?: string;
    serviceName?: string;
    shopName?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (data: { orderId: string; rating: number; comment: string }) => {
      const response = await apiClient.post("/services/reviews", data);
      return response.data;
    },
    onSuccess: () => {
      Alert.alert(
        "Review Submitted",
        "Thank you for your feedback!",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || "Failed to submit review. Please try again.";
      Alert.alert("Error", message);
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating.");
      return;
    }

    submitReviewMutation.mutate({
      orderId: orderId!,
      rating,
      comment: comment.trim(),
    });
  };

  const renderStars = () => {
    return (
      <View className="flex-row justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={40}
              color={star <= rating ? "#FFCC00" : "#6B7280"}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = () => {
    switch (rating) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "Tap to rate";
    }
  };

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-4 border-b border-gray-800">
        <TouchableOpacity onPress={goBack} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold flex-1">Write Review</Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Service Info */}
        <View className="py-6">
          <View className="bg-zinc-900 rounded-xl p-4">
            <Text className="text-gray-400 text-sm mb-1">Service</Text>
            <Text className="text-white text-lg font-semibold">
              {serviceName || "Service"}
            </Text>
            {shopName && (
              <Text className="text-gray-500 text-sm mt-1">at {shopName}</Text>
            )}
          </View>
        </View>

        {/* Rating Section */}
        <View className="mb-6">
          <Text className="text-white text-lg font-semibold mb-4 text-center">
            How was your experience?
          </Text>

          {renderStars()}

          <Text
            className={`text-center mt-3 text-lg font-medium ${
              rating > 0 ? "text-[#FFCC00]" : "text-gray-500"
            }`}
          >
            {getRatingText()}
          </Text>
        </View>

        {/* Comment Section */}
        <View className="mb-6">
          <Text className="text-white text-base font-medium mb-2">
            Share your thoughts (optional)
          </Text>
          <TextInput
            className="bg-zinc-900 rounded-xl p-4 text-white text-base min-h-[120px]"
            placeholder="Tell others about your experience..."
            placeholderTextColor="#6B7280"
            multiline
            textAlignVertical="top"
            value={comment}
            onChangeText={setComment}
            maxLength={500}
          />
          <Text className="text-gray-500 text-sm text-right mt-2">
            {comment.length}/500
          </Text>
        </View>

        {/* Tips */}
        <View className="bg-[#FFCC00]/10 rounded-xl p-4 mb-6">
          <View className="flex-row items-center mb-2">
            <Ionicons name="bulb-outline" size={20} color="#FFCC00" />
            <Text className="text-[#FFCC00] font-semibold ml-2">Tips for a helpful review</Text>
          </View>
          <Text className="text-gray-400 text-sm leading-5">
            • Describe what made your experience good or bad{"\n"}
            • Mention specific details about the service{"\n"}
            • Be honest and constructive
          </Text>
        </View>

        {/* Spacer */}
        <View className="h-24" />
      </ScrollView>

      {/* Submit Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-gray-800 pb-8">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={rating === 0 || submitReviewMutation.isPending}
          className={`rounded-xl py-4 items-center ${
            rating > 0 ? "bg-[#FFCC00]" : "bg-gray-700"
          }`}
          activeOpacity={0.8}
        >
          {submitReviewMutation.isPending ? (
            <ActivityIndicator size="small" color="black" />
          ) : (
            <Text
              className={`text-lg font-bold ${
                rating > 0 ? "text-black" : "text-gray-500"
              }`}
            >
              Submit Review
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
