import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  Share,
  Modal,
  Pressable,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams, router } from "expo-router";
import { useService } from "@/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/config/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { appointmentApi } from "@/services/appointment.services";
import {
  ShopAvailability,
  TimeSlotConfig,
  DateOverride,
} from "@/interfaces/appointment.interface";

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetService, useUpdateService } = useService();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const { mutateAsync: updateServiceMutation } = useUpdateService();
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const shopId = userProfile?.shopId;

  const [isUpdating, setIsUpdating] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Availability state
  const [availability, setAvailability] = useState<ShopAvailability[]>([]);
  const [timeSlotConfig, setTimeSlotConfig] = useState<TimeSlotConfig | null>(
    null
  );
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const FULL_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const [showAllHours, setShowAllHours] = useState(false);

  // Fetch availability data
  useEffect(() => {
    if (shopId) {
      loadAvailabilityData();
    }
  }, [shopId]);

  const loadAvailabilityData = async () => {
    setLoadingAvailability(true);
    try {
      const [availRes, configRes] = await Promise.all([
        appointmentApi.getShopAvailability(shopId!),
        appointmentApi.getTimeSlotConfig(),
      ]);

      if (availRes.data) {
        const sorted = [...availRes.data].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek
        );
        setAvailability(sorted);
      }
      if (configRes.data) {
        setTimeSlotConfig(configRes.data);
      }
    } catch (error) {
      console.error("Failed to load availability data:", error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "--:--";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const period = h < 12 ? "AM" : "PM";
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:${minute} ${period}`;
  };

  // Get today's availability
  const getTodayAvailability = () => {
    const today = new Date().getDay();
    return availability.find((a) => a.dayOfWeek === today);
  };

  // Group consecutive days with same hours
  const getGroupedHours = () => {
    if (availability.length === 0) return [];

    const groups: {
      days: number[];
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
    }[] = [];

    availability.forEach((day) => {
      const lastGroup = groups[groups.length - 1];
      const isSameSchedule =
        lastGroup &&
        lastGroup.isOpen === day.isOpen &&
        lastGroup.openTime === day.openTime &&
        lastGroup.closeTime === day.closeTime;

      if (isSameSchedule) {
        lastGroup.days.push(day.dayOfWeek);
      } else {
        groups.push({
          days: [day.dayOfWeek],
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
        });
      }
    });

    return groups;
  };

  // Format day range
  const formatDayRange = (days: number[]) => {
    if (days.length === 1) return DAYS[days[0]];
    if (days.length === 7) return "Every day";

    // Check if consecutive
    const isConsecutive = days.every(
      (d, i) => i === 0 || d === days[i - 1] + 1
    );
    if (isConsecutive && days.length > 2) {
      return `${DAYS[days[0]]} - ${DAYS[days[days.length - 1]]}`;
    }
    return days.map((d) => DAYS[d]).join(", ");
  };

  // Count open days
  const openDaysCount = availability.filter((a) => a.isOpen).length;

  // Generate share URL and message
  const getShareUrl = () => {
    return `https://repaircoin.app/service/${id}`;
  };

  const getShareMessage = () => {
    if (!serviceData) return "";
    return `Check out ${serviceData.serviceName} - $${serviceData.priceUsd}`;
  };

  // Share handlers
  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(getShareUrl());
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
      setShowShareModal(false);
    }, 1500);
  };

  const handleShareWhatsApp = async () => {
    const message = `${getShareMessage()}\n${getShareUrl()}`;
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
    setShowShareModal(false);
  };

  const handleShareTwitter = async () => {
    const message = getShareMessage();
    const url = `twitter://post?message=${encodeURIComponent(message)}&url=${encodeURIComponent(getShareUrl())}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(getShareUrl())}`;

    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(webUrl);
    }
    setShowShareModal(false);
  };

  const handleShareFacebook = async () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
    await Linking.openURL(url);
    setShowShareModal(false);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `${getShareMessage()}\n${getShareUrl()}`,
        url: getShareUrl(),
        title: serviceData?.serviceName || "Check out this service",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
    setShowShareModal(false);
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return "Other";
    const cat = SERVICE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleToggleStatus = async (value: boolean) => {
    if (!isUpdating && serviceData) {
      setIsUpdating(true);
      try {
        await updateServiceMutation({
          serviceId: id!,
          serviceData: { active: value },
        });

        await queryClient.invalidateQueries({
          queryKey: queryKeys.service(id!),
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.shopServices(shopId!),
        });

        Alert.alert(
          "Success",
          `Service ${value ? "activated" : "deactivated"} successfully`
        );
      } catch (error) {
        console.error("Failed to update service status:", error);
        Alert.alert("Error", "Failed to update service status");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleEdit = () => {
    if (serviceData) {
      router.push({
        pathname: "/shop/service-form",
        params: {
          mode: "edit",
          serviceId: serviceData.serviceId,
          data: JSON.stringify(serviceData),
        },
      });
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
          <TouchableOpacity onPress={goBack}>
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
            onPress={goBack}
            className="absolute top-14 left-4 bg-black/50 rounded-full p-2"
          >
            <Ionicons name="arrow-back" color="white" size={24} />
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity
            onPress={() => setShowShareModal(true)}
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
                <Text className="text-white text-lg font-semibold mb-4">
                  Tags
                </Text>
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
                  <Text className="text-gray-400 text-sm">
                    {openDaysCount}/7 days
                  </Text>
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
                                name={
                                  today?.isOpen
                                    ? "checkmark-circle"
                                    : "close-circle"
                                }
                                size={24}
                                color={today?.isOpen ? "#22c55e" : "#ef4444"}
                              />
                            </View>
                            <View>
                              <Text className="text-white font-semibold">
                                {today?.isOpen ? "Open Today" : "Closed Today"}
                              </Text>
                              <Text className="text-gray-500 text-xs">
                                {todayName}
                              </Text>
                            </View>
                          </View>
                          {today?.isOpen && (
                            <View className="items-end">
                              <Text className="text-[#FFCC00] font-semibold">
                                {formatTime(today.openTime)} -{" "}
                                {formatTime(today.closeTime)}
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
                    <Text className="text-gray-400 text-sm">
                      Weekly Schedule
                    </Text>
                    <Ionicons
                      name={showAllHours ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#9CA3AF"
                    />
                  </View>

                  {availability.length === 0 ? (
                    <Text className="text-gray-500 text-sm">
                      No hours configured
                    </Text>
                  ) : showAllHours ? (
                    // Expanded view - show all days
                    <View>
                      {availability.map((day) => (
                        <View
                          key={day.dayOfWeek}
                          className="flex-row items-center justify-between py-2 border-b border-gray-800 last:border-b-0"
                        >
                          <View className="flex-row items-center">
                            <View
                              className={`w-2 h-2 rounded-full mr-3 ${
                                day.isOpen ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <Text className="text-white">
                              {FULL_DAYS[day.dayOfWeek]}
                            </Text>
                          </View>
                          <Text
                            className={
                              day.isOpen ? "text-white" : "text-gray-500"
                            }
                          >
                            {day.isOpen
                              ? `${formatTime(day.openTime)} - ${formatTime(day.closeTime)}`
                              : "Closed"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    // Compact view - show grouped hours
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
                              group.isOpen
                                ? "text-white text-sm"
                                : "text-gray-500 text-sm"
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
                    <Text className="text-gray-400 text-sm mb-3">
                      Booking Settings
                    </Text>
                    <View className="flex-row justify-between">
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons
                            name="timer-outline"
                            size={20}
                            color="#FFCC00"
                          />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.slotDurationMinutes}m
                        </Text>
                        <Text className="text-gray-500 text-xs">Duration</Text>
                      </View>
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons
                            name="pause-outline"
                            size={20}
                            color="#FFCC00"
                          />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.bufferTimeMinutes}m
                        </Text>
                        <Text className="text-gray-500 text-xs">Buffer</Text>
                      </View>
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons
                            name="people-outline"
                            size={20}
                            color="#FFCC00"
                          />
                        </View>
                        <Text className="text-white text-sm font-semibold">
                          {timeSlotConfig.maxConcurrentBookings}
                        </Text>
                        <Text className="text-gray-500 text-xs">Max</Text>
                      </View>
                      <View className="items-center flex-1">
                        <View className="w-10 h-10 bg-[#252525] rounded-full items-center justify-center mb-2">
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color="#FFCC00"
                          />
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

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Additional Info */}
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons
                name="information-circle-outline"
                size={22}
                color="#FFCC00"
              />
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
          <Text className="text-black text-lg font-bold ml-2">
            Edit Service
          </Text>
        </TouchableOpacity>
      </View>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowShareModal(false)}
        >
          <Pressable
            className="bg-zinc-900 rounded-t-3xl px-4 pt-6 pb-10"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-xl font-bold">
                Share Service
              </Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Share Options */}
            <View className="flex-row justify-around mb-6">
              {/* Copy Link */}
              <TouchableOpacity
                onPress={handleCopyLink}
                className="items-center"
              >
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center ${copySuccess ? "bg-green-500" : "bg-zinc-800"}`}
                >
                  <Ionicons
                    name={copySuccess ? "checkmark" : "link"}
                    size={24}
                    color="white"
                  />
                </View>
                <Text className="text-gray-400 text-xs mt-2">
                  {copySuccess ? "Copied!" : "Copy Link"}
                </Text>
              </TouchableOpacity>

              {/* WhatsApp */}
              <TouchableOpacity
                onPress={handleShareWhatsApp}
                className="items-center"
              >
                <View className="w-14 h-14 bg-[#25D366] rounded-full items-center justify-center">
                  <Ionicons name="logo-whatsapp" size={24} color="white" />
                </View>
                <Text className="text-gray-400 text-xs mt-2">WhatsApp</Text>
              </TouchableOpacity>

              {/* Twitter/X */}
              <TouchableOpacity
                onPress={handleShareTwitter}
                className="items-center"
              >
                <View className="w-14 h-14 bg-black rounded-full items-center justify-center border border-zinc-700">
                  <Ionicons name="logo-twitter" size={24} color="white" />
                </View>
                <Text className="text-gray-400 text-xs mt-2">Twitter</Text>
              </TouchableOpacity>

              {/* Facebook */}
              <TouchableOpacity
                onPress={handleShareFacebook}
                className="items-center"
              >
                <View className="w-14 h-14 bg-[#1877F2] rounded-full items-center justify-center">
                  <Ionicons name="logo-facebook" size={24} color="white" />
                </View>
                <Text className="text-gray-400 text-xs mt-2">Facebook</Text>
              </TouchableOpacity>
            </View>

            {/* More Options Button */}
            <TouchableOpacity
              onPress={handleNativeShare}
              className="bg-zinc-800 rounded-xl py-4 items-center flex-row justify-center"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFCC00" />
              <Text className="text-white text-base font-semibold ml-2">
                More Options
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
