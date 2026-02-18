import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";

// Feature imports
import { useAuthStore } from "@/shared/store/auth.store";
import {
  useServiceDetailQuery,
  useShopAvailabilityWithConfigQuery,
  useServiceNavigation,
  useServiceDetailUI,
} from "../hooks";
import { ShareModal, ShopReviewsSection } from "../components";
import { getCategoryLabel } from "@/shared/utilities/getCategoryLabel";
import { FULL_DAYS } from "../constants";
import { serviceApi } from "@/shared/services/service.services";
import { ReviewData, ReviewStats } from "@/shared/interfaces/review.interface";

export default function ServicesViewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  // Hooks
  const { navigateBack, navigateToEdit } = useServiceNavigation();
  const { data: serviceData, isLoading, error } = useServiceDetailQuery(id);
  const { data: availabilityData, isLoading: loadingAvailability } =
    useShopAvailabilityWithConfigQuery(shopId);

  const availability = availabilityData?.availability ?? [];
  const timeSlotConfig = availabilityData?.timeSlotConfig ?? null;

  const {
    showShareModal,
    copySuccess,
    showAllHours,
    setShowAllHours,
    openShareModal,
    closeShareModal,
    handleCopyLink,
    handleShareWhatsApp,
    handleShareTwitter,
    handleShareFacebook,
    handleNativeShare,
    formatTime,
    formatDate,
    getTodayAvailability,
    getGroupedHours,
    formatDayRange,
    openDaysCount,
  } = useServiceDetailUI({
    serviceId: id!,
    serviceData,
    shopId,
    availability,
  });

  // Reviews state
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Load reviews
  useEffect(() => {
    if (id) {
      loadReviews();
    }
  }, [id]);

  const loadReviews = async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const response = await serviceApi.getServiceReviews(id, { limit: 50 });
      if (response?.data) {
        setReviews(response.data);
        if (response.stats) {
          setReviewStats(response.stats);
        }
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleViewAllReviews = () => {
    router.push(`/shop/service/${id}/reviews`);
  };

  const handleEdit = () => {
    if (serviceData) {
      navigateToEdit(serviceData);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#FFCC00" />
      </View>
    );
  }

  if (error || !serviceData) {
    return (
      <View className="flex-1 bg-zinc-950">
        <View className="pt-16 px-4">
          <TouchableOpacity onPress={navigateBack}>
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text className="text-white text-lg mt-4">Service not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          {serviceData.imageUrl ? (
            <Image
              source={{ uri: serviceData.imageUrl }}
              className="w-full h-64"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-64 bg-gray-800 items-center justify-center">
              <Ionicons name="image-outline" size={64} color="#6B7280" />
            </View>
          )}

          {/* Back Button Overlay */}
          <TouchableOpacity
            onPress={navigateBack}
            className="absolute top-14 left-4 bg-black/50 rounded-full p-2"
          >
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity
            onPress={openShareModal}
            className="absolute top-14 right-4 bg-black/50 rounded-full p-2"
          >
            <Ionicons name="share-social-outline" color="white" size={22} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Category & Duration */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="bg-gray-800 px-3 py-1 rounded-full">
              <Text className="text-gray-400 text-xs uppercase">
                {getCategoryLabel(serviceData.category)}
              </Text>
            </View>
          </View>

          {/* Service Name */}
          <Text className="text-white text-2xl font-bold mb-2">
            {serviceData.serviceName}
          </Text>

          {/* Price */}
          <Text className="text-[#FFCC00] text-3xl font-bold mb-4">
            ${serviceData.priceUsd}
          </Text>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-gray-400 text-base leading-6">
              {serviceData.description || "No description available."}
            </Text>
          </View>

          {/* Tags */}
          {serviceData.tags && serviceData.tags.length > 0 && (
            <>
              <View className="h-px bg-gray-800 mb-6" />
              <View className="mb-6">
                <Text className="text-white text-lg font-semibold mb-4">Tags</Text>
                <View className="flex-row flex-wrap">
                  {serviceData.tags.map((tag, index) => (
                    <View
                      key={index}
                      className="bg-gray-800 px-3 py-1 rounded-full mr-2 mb-2"
                    >
                      <Text className="text-gray-400 text-sm">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          {/* Availability Section */}
          <View className="h-px bg-gray-800 mb-6" />
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={22} color="#FFCC00" />
                <Text className="text-white text-lg font-semibold ml-2">
                  Availability
                </Text>
              </View>
              {availability.length > 0 && (
                <View className="flex-row items-center">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${openDaysCount > 0 ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <Text className="text-gray-400 text-sm">{openDaysCount}/7 days</Text>
                </View>
              )}
            </View>

            {loadingAvailability ? (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color="#FFCC00" />
              </View>
            ) : (
              <>
                {/* Today's Status - Prominent Card */}
                {availability.length > 0 && (
                  <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
                    {(() => {
                      const today = getTodayAvailability();
                      const todayName = FULL_DAYS[new Date().getDay()];
                      return (
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <View
                              className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${today?.isOpen ? "bg-green-500/20" : "bg-red-500/20"}`}
                            >
                              <Ionicons
                                name={today?.isOpen ? "checkmark-circle" : "close-circle"}
                                size={24}
                                color={today?.isOpen ? "#22c55e" : "#ef4444"}
                              />
                            </View>
                            <View>
                              <Text className="text-white font-semibold">
                                {today?.isOpen ? "Open Today" : "Closed Today"}
                              </Text>
                              <Text className="text-gray-500 text-xs">{todayName}</Text>
                            </View>
                          </View>
                          {today?.isOpen && (
                            <View className="items-end">
                              <Text className="text-[#FFCC00] font-semibold">
                                {formatTime(today.openTime)} - {formatTime(today.closeTime)}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                )}

                {/* Grouped Hours - Compact View */}
                <TouchableOpacity
                  onPress={() => setShowAllHours(!showAllHours)}
                  className="bg-[#1a1a1a] rounded-xl p-4 mb-3"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-gray-400 text-sm">Weekly Schedule</Text>
                    <Ionicons
                      name={showAllHours ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#9CA3AF"
                    />
                  </View>

                  {availability.length === 0 ? (
                    <Text className="text-gray-500 text-sm">No hours configured</Text>
                  ) : showAllHours ? (
                    <View>
                      {availability.map((day) => (
                        <View
                          key={day.dayOfWeek}
                          className="flex-row items-center justify-between py-2 border-b border-gray-800 last:border-b-0"
                        >
                          <View className="flex-row items-center">
                            <View
                              className={`w-2 h-2 rounded-full mr-3 ${day.isOpen ? "bg-green-500" : "bg-red-500"}`}
                            />
                            <Text className="text-white">{FULL_DAYS[day.dayOfWeek]}</Text>
                          </View>
                          <Text className={day.isOpen ? "text-white" : "text-gray-500"}>
                            {day.isOpen
                              ? `${formatTime(day.openTime)} - ${formatTime(day.closeTime)}`
                              : "Closed"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View>
                      {getGroupedHours().map((group, index) => (
                        <View
                          key={index}
                          className="flex-row items-center justify-between py-1"
                        >
                          <Text className="text-gray-400 text-sm">
                            {formatDayRange(group.days)}
                          </Text>
                          <Text
                            className={
                              group.isOpen ? "text-white text-sm" : "text-gray-500 text-sm"
                            }
                          >
                            {group.isOpen
                              ? `${formatTime(group.openTime)} - ${formatTime(group.closeTime)}`
                              : "Closed"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Booking Settings - Compact Icons */}
                {timeSlotConfig && (
                  <View className="bg-[#1a1a1a] rounded-xl p-4 mb-3">
                    <Text className="text-gray-400 text-sm mb-3">Booking Settings</Text>
                    <View className="flex-row justify-between">
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons name="timer-outline" size={20} color="#FFCC00" />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.slotDurationMinutes}m
                        </Text>
                        <Text className="text-gray-500 text-xs">Duration</Text>
                      </View>
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons name="pause-outline" size={20} color="#FFCC00" />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.bufferTimeMinutes}m
                        </Text>
                        <Text className="text-gray-500 text-xs">Buffer</Text>
                      </View>
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons name="people-outline" size={20} color="#FFCC00" />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.maxConcurrentBookings}
                        </Text>
                        <Text className="text-gray-500 text-xs">Max</Text>
                      </View>
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons name="calendar-outline" size={20} color="#FFCC00" />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.bookingAdvanceDays}d
                        </Text>
                        <Text className="text-gray-500 text-xs">Advance</Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Reviews Section */}
          <View className="h-px bg-gray-800 mb-6" />
          <ShopReviewsSection
            reviews={reviews}
            stats={reviewStats}
            isLoading={reviewsLoading}
            onSeeAll={handleViewAllReviews}
            onReviewUpdated={loadReviews}
          />

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Additional Info */}
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="information-circle-outline" size={22} color="#FFCC00" />
              <Text className="text-white text-lg font-semibold ml-2">
                Additional Information
              </Text>
            </View>

            <View className="flex-row items-center mb-3">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Created On</Text>
                <Text className="text-white text-base">
                  {formatDate(serviceData.createdAt)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="refresh-outline" size={20} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Last Updated</Text>
                <Text className="text-white text-base">
                  {formatDate(serviceData.updatedAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-6 pt-4 pb-8 border-t border-gray-800">
        <TouchableOpacity
          onPress={handleEdit}
          className="bg-[#FFCC00] rounded-xl py-4 flex-row items-center justify-center"
          activeOpacity={0.8}
        >
          <Ionicons name="pencil" size={20} color="black" />
          <Text className="text-black text-lg font-bold ml-2">Edit Service</Text>
        </TouchableOpacity>
      </View>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={closeShareModal}
        copySuccess={copySuccess}
        onCopyLink={handleCopyLink}
        onShareWhatsApp={handleShareWhatsApp}
        onShareTwitter={handleShareTwitter}
        onShareFacebook={handleShareFacebook}
        onNativeShare={handleNativeShare}
      />
    </View>
  );
}
