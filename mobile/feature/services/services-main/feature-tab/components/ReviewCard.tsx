import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ReviewData, ReviewReply } from "@/feature/services/services/service.interface";
import { serviceApi } from "@/feature/services/services/service.services";

interface ReviewCardProps {
  review: ReviewData;
  isShopOwner?: boolean;
  currentUserAddress?: string;
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

function StarPicker({ rating, onSelect }: { rating: number; onSelect: (r: number) => void }) {
  return (
    <View className="flex-row gap-1 mb-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onSelect(star)}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={22}
            color={star <= rating ? "#FFCC00" : "#4B5563"}
          />
        </TouchableOpacity>
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

export default function ReviewCard({ review, isShopOwner = false, currentUserAddress, onReviewUpdated }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shop response state
  const [isResponding, setIsResponding] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [editResponseText, setEditResponseText] = useState(review.shopResponse ?? "");

  // Edit review state
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");

  // Thread replies state
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [isAddingReply, setIsAddingReply] = useState(false);
  const [newReplyText, setNewReplyText] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState("");

  const isReviewer =
    !!currentUserAddress &&
    review.customerAddress.toLowerCase() === currentUserAddress.toLowerCase();

  const canEditReview = isReviewer && !review.shopResponse;
  const canEditShopResponse = isShopOwner && !!review.shopResponse;

  // Thread reply eligibility — alternating turns
  const replies: ReviewReply[] = review.replies ?? [];
  const lastReply = replies[replies.length - 1];
  const canCustomerReply = isReviewer && !!review.shopResponse && (replies.length === 0 || lastReply?.authorType === 'shop');
  const canShopReply = isShopOwner && replies.length > 0 && lastReply?.authorType === 'customer';
  const canAddReply = canCustomerReply || canShopReply;

  const COLLAPSED_COUNT = 2;
  const visibleReplies = threadExpanded ? replies : replies.slice(-COLLAPSED_COUNT);
  const hiddenCount = replies.length - COLLAPSED_COUNT;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (name: string | null, address: string) => {
    if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    return address.slice(2, 4).toUpperCase();
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) { Alert.alert("Error", "Please enter a response"); return; }
    setIsSubmitting(true);
    try {
      await serviceApi.addShopResponse(review.reviewId, responseText);
      setIsResponding(false);
      setResponseText("");
      onReviewUpdated?.();
    } catch {
      Alert.alert("Error", "Failed to add response");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEditReview = async () => {
    setIsSubmitting(true);
    try {
      await serviceApi.updateReview(review.reviewId, { rating: editRating, comment: editComment });
      setIsEditingReview(false);
      onReviewUpdated?.();
    } catch {
      Alert.alert("Error", "Failed to update review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEditResponse = async () => {
    if (!editResponseText.trim()) { Alert.alert("Error", "Please enter a response"); return; }
    setIsSubmitting(true);
    try {
      await serviceApi.updateShopResponse(review.reviewId, editResponseText);
      setIsEditingResponse(false);
      onReviewUpdated?.();
    } catch {
      Alert.alert("Error", "Failed to update response");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitThreadReply = async () => {
    if (!newReplyText.trim()) return;
    setIsSubmitting(true);
    try {
      await serviceApi.addThreadReply(review.reviewId, newReplyText);
      setIsAddingReply(false);
      setNewReplyText("");
      onReviewUpdated?.();
    } catch {
      Alert.alert("Error", "Failed to add reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEditThreadReply = async () => {
    if (!editReplyContent.trim() || !editingReplyId) return;
    setIsSubmitting(true);
    try {
      await serviceApi.editThreadReply(editingReplyId, editReplyContent);
      setEditingReplyId(null);
      setEditReplyContent("");
      onReviewUpdated?.();
    } catch {
      Alert.alert("Error", "Failed to update reply");
    } finally {
      setIsSubmitting(false);
    }
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
            {review.customerName || `${review.customerAddress.slice(0, 6)}...${review.customerAddress.slice(-4)}`}
          </Text>
          <View className="flex-row items-center mt-1">
            <StarDisplay rating={review.rating} />
            <Text className="text-gray-500 text-xs ml-2">{formatDate(review.createdAt)}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {review.helpfulCount > 0 && (
            <View className="flex-row items-center bg-[#252525] rounded-full px-2 py-1">
              <Ionicons name="thumbs-up" size={12} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs ml-1">{review.helpfulCount}</Text>
            </View>
          )}
          {canEditReview && !isEditingReview && (
            <TouchableOpacity
              onPress={() => { setEditRating(review.rating); setEditComment(review.comment ?? ""); setIsEditingReview(true); }}
              className="p-1"
            >
              <Ionicons name="pencil-outline" size={15} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Edit review form */}
      {isEditingReview ? (
        <View className="bg-[#0d0d0d] border border-gray-700 rounded-lg p-3 mb-2">
          <StarPicker rating={editRating} onSelect={setEditRating} />
          <TextInput
            value={editComment}
            onChangeText={setEditComment}
            placeholder="Update your review..."
            placeholderTextColor="#6B7280"
            multiline
            maxLength={2000}
            className="text-white text-sm min-h-[70px]"
            style={{ textAlignVertical: "top" }}
          />
          <View className="flex-row gap-2 mt-3">
            <TouchableOpacity
              onPress={handleSubmitEditReview}
              disabled={isSubmitting}
              className={`flex-1 bg-[#FFCC00] rounded-lg py-2 items-center ${isSubmitting ? "opacity-50" : ""}`}
            >
              {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-black font-semibold text-sm">Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsEditingReview(false)}
              className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg"
            >
              <Text className="text-white text-sm">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Comment display */
        review.comment && (
          <TouchableOpacity
            onPress={() => shouldTruncate && setIsExpanded(!isExpanded)}
            activeOpacity={shouldTruncate ? 0.7 : 1}
          >
            <Text className="text-gray-300 text-sm leading-5" numberOfLines={isExpanded ? undefined : 4}>
              {review.comment}
            </Text>
            {shouldTruncate && (
              <Text className="text-[#FFCC00] text-sm mt-1">{isExpanded ? "Show less" : "Read more"}</Text>
            )}
          </TouchableOpacity>
        )
      )}

      {/* Images */}
      {review.images && review.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
          {review.images.map((image, index) => <ReviewImage key={index} uri={image} />)}
        </ScrollView>
      )}

      {/* Response Thread */}
      {review.shopResponse ? (
        <View className="mt-3">

          {/* Shop Response */}
          <View className="flex-row">
            <View className="items-center mr-3" style={{ width: 24 }}>
              <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: isShopOwner ? "rgba(96,165,250,0.15)" : "rgba(255,204,0,0.15)" }}>
                <Ionicons name="storefront-outline" size={11} color={isShopOwner ? "#60A5FA" : "#FFCC00"} />
              </View>
              {(replies.length > 0 || canAddReply || isAddingReply) && (
                <View className="flex-1 mt-1" style={{ width: 1, backgroundColor: "#374151" }} />
              )}
            </View>
            <View className="flex-1 pb-3">
              <View className="flex-row items-center mb-1">
                <Text className={`text-xs font-semibold ${isShopOwner ? "text-blue-400" : "text-[#FFCC00]"}`}>
                  {isShopOwner ? "You" : "Shop"}
                </Text>
                {review.shopResponseAt && <Text className="text-gray-500 text-xs ml-2">{formatDate(review.shopResponseAt)}</Text>}
                {canEditShopResponse && !isEditingResponse && (
                  <TouchableOpacity onPress={() => { setEditResponseText(review.shopResponse ?? ""); setIsEditingResponse(true); }} className="ml-auto p-1">
                    <Ionicons name="pencil-outline" size={13} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>
              {isEditingResponse ? (
                <>
                  <TextInput value={editResponseText} onChangeText={setEditResponseText} placeholder="Edit your response..." placeholderTextColor="#6B7280" multiline maxLength={2000} className="text-white text-sm min-h-[70px]" style={{ textAlignVertical: "top" }} />
                  <Text className="text-gray-500 text-xs mt-1 text-right">{editResponseText.length}/2000</Text>
                  <View className="flex-row gap-2 mt-2">
                    <TouchableOpacity onPress={handleSubmitEditResponse} disabled={isSubmitting || !editResponseText.trim()} className={`flex-1 bg-[#FFCC00] rounded-lg py-2 items-center ${isSubmitting || !editResponseText.trim() ? "opacity-50" : ""}`}>
                      {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-black font-semibold text-sm">Save</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsEditingResponse(false)} className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
                      <Text className="text-white text-sm">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text className="text-gray-300 text-sm">{review.shopResponse}</Text>
              )}
            </View>
          </View>

          {/* "Show X more" collapse button */}
          {hiddenCount > 0 && !threadExpanded && (
            <TouchableOpacity onPress={() => setThreadExpanded(true)} className="flex-row items-center ml-9 mb-2">
              <Ionicons name="chevron-down-outline" size={13} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs ml-1">Show {hiddenCount} more {hiddenCount === 1 ? "reply" : "replies"}</Text>
            </TouchableOpacity>
          )}

          {/* Thread replies */}
          {visibleReplies.map((reply, index) => {
            const isShopReply = reply.authorType === 'shop';
            const isOwnReply = currentUserAddress?.toLowerCase() === reply.authorAddress.toLowerCase();
            const isLast = index === visibleReplies.length - 1;
            const hasMore = replies.length > 0 && !isLast;

            return (
              <View key={reply.id} className="flex-row">
                <View className="items-center mr-3" style={{ width: 24 }}>
                  {isShopReply ? (
                    <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: isShopOwner ? "rgba(96,165,250,0.15)" : "rgba(255,204,0,0.15)" }}>
                      <Ionicons name="storefront-outline" size={11} color={isShopOwner ? "#60A5FA" : "#FFCC00"} />
                    </View>
                  ) : (
                    <View className="w-6 h-6 rounded-full bg-[#333] items-center justify-center">
                      <Text className="text-white font-bold" style={{ fontSize: 9 }}>{getInitials(review.customerName, review.customerAddress)}</Text>
                    </View>
                  )}
                  {(hasMore || (!isLast) || canAddReply || isAddingReply) && (
                    <View className="flex-1 mt-1" style={{ width: 1, backgroundColor: "#374151" }} />
                  )}
                </View>
                <View className="flex-1 pb-3">
                  <View className="flex-row items-center mb-1">
                    <Text className={`text-xs font-semibold ${isShopReply ? (isShopOwner ? "text-blue-400" : "text-[#FFCC00]") : "text-gray-300"}`}>
                      {isShopReply ? (isShopOwner ? "You" : "Shop") : (isReviewer ? "You" : (review.customerName || "Customer"))}
                    </Text>
                    <Text className="text-gray-500 text-xs ml-2">{formatDate(reply.createdAt)}</Text>
                    {isOwnReply && editingReplyId !== reply.id && (
                      <TouchableOpacity onPress={() => { setEditingReplyId(reply.id); setEditReplyContent(reply.content); }} className="ml-auto p-1">
                        <Ionicons name="pencil-outline" size={13} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {editingReplyId === reply.id ? (
                    <>
                      <TextInput value={editReplyContent} onChangeText={setEditReplyContent} placeholder="Edit your reply..." placeholderTextColor="#6B7280" multiline maxLength={1000} className="text-white text-sm min-h-[60px]" style={{ textAlignVertical: "top" }} />
                      <Text className="text-gray-500 text-xs mt-1 text-right">{editReplyContent.length}/1000</Text>
                      <View className="flex-row gap-2 mt-2">
                        <TouchableOpacity onPress={handleSubmitEditThreadReply} disabled={isSubmitting || !editReplyContent.trim()} className={`flex-1 bg-[#FFCC00] rounded-lg py-2 items-center ${isSubmitting || !editReplyContent.trim() ? "opacity-50" : ""}`}>
                          {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-black font-semibold text-sm">Save</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setEditingReplyId(null); setEditReplyContent(""); }} className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
                          <Text className="text-white text-sm">Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text className="text-gray-300 text-sm">{reply.content}</Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Add reply input */}
          {isAddingReply ? (
            <View className="flex-row">
              <View className="items-center mr-3" style={{ width: 24 }}>
                {canCustomerReply ? (
                  <View className="w-6 h-6 rounded-full bg-[#333] items-center justify-center">
                    <Text className="text-white font-bold" style={{ fontSize: 9 }}>{getInitials(review.customerName, review.customerAddress)}</Text>
                  </View>
                ) : (
                  <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,0.15)" }}>
                    <Ionicons name="storefront-outline" size={11} color="#60A5FA" />
                  </View>
                )}
              </View>
              <View className="flex-1">
                <TextInput value={newReplyText} onChangeText={setNewReplyText} placeholder="Write a reply..." placeholderTextColor="#6B7280" multiline maxLength={1000} className="text-white text-sm min-h-[60px] bg-[#0d0d0d] border border-gray-700 rounded-lg p-2" style={{ textAlignVertical: "top" }} />
                <Text className="text-gray-500 text-xs mt-1 text-right">{newReplyText.length}/1000</Text>
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity onPress={handleSubmitThreadReply} disabled={isSubmitting || !newReplyText.trim()} className={`flex-1 bg-[#FFCC00] rounded-lg py-2 items-center ${isSubmitting || !newReplyText.trim() ? "opacity-50" : ""}`}>
                    {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-black font-semibold text-sm">Submit</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setIsAddingReply(false); setNewReplyText(""); }} className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
                    <Text className="text-white text-sm">Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : canAddReply ? (
            <TouchableOpacity onPress={() => setIsAddingReply(true)} className="flex-row items-center ml-9">
              <Ionicons name="chatbubble-outline" size={13} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs ml-1">{canCustomerReply ? "Reply to shop" : "Reply to customer"}</Text>
            </TouchableOpacity>
          ) : null}

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
              className={`flex-1 bg-[#FFCC00] rounded-lg py-3 items-center ${isSubmitting || !responseText.trim() ? "opacity-50" : ""}`}
            >
              {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-black font-semibold">Submit Response</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setIsResponding(false); setResponseText(""); }}
              className="px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg"
            >
              <Text className="text-white">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : isShopOwner ? (
        <TouchableOpacity onPress={() => setIsResponding(true)} className="mt-3 flex-row items-center">
          <Ionicons name="chatbubble-outline" size={16} color="#60A5FA" />
          <Text className="text-blue-400 text-sm ml-2">Respond to this review</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
