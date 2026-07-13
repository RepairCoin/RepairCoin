import { useState, useEffect } from "react";
import Constants from "expo-constants";
import { Linking, Share, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useQuery } from "@tanstack/react-query";
import { useGetServiceQuery, useTrackRecentlyViewedMutation, useDeleteServiceMutation } from "./useFeatureTabQuery";
import { useCustomer } from "@/feature/customer/profile/hooks/useCustomer";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { messageApi } from "@/feature/messages/services/message.services";
import { serviceApi } from "@/feature/services/services/service.services";
import { SERVICE_CATEGORIES } from "@/shared/constants/service-categories";
import { queryKeys } from "@/shared/config/queryClient";
import { TIER_CONFIG, COPY_FEEDBACK_DURATION, FULL_DAYS } from "@/shared/constants/services";
import { TierInfo, RewardCalculation } from "@/feature/services/services/service.interface";
import { useShopAvailabilityWithConfigQuery } from "@/feature/services/services-main/services-tab/hooks/useServicesTabQuery";
import { useServiceNavigation } from "./useServiceNavigation";

export function useUnifiedServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account, userType, userProfile } = useAuthStore();

  // Determine user role and ownership
  const isCustomer = userType === "customer";
  const isShop = userType === "shop";
  const shopId = userProfile?.shopId;

  // Get service data
  const { data: serviceData, isLoading, error } = useGetServiceQuery(id!);
  const { mutate: trackView } = useTrackRecentlyViewedMutation();

  // Check if shop owner is viewing their own service
  const isShopOwner = isShop && serviceData?.shopId === shopId;

  // Navigation
  const { navigateToEdit } = useServiceNavigation();

  // Shop availability (only for shop owners)
  const { data: availabilityData, isLoading: loadingAvailability } =
    useShopAvailabilityWithConfigQuery(isShopOwner ? shopId : undefined);

  const availability = availabilityData?.availability ?? [];
  const timeSlotConfig = availabilityData?.timeSlotConfig ?? null;

  // Customer data (for rewards calculation)
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { data: customerData } = useGetCustomerByWalletAddress(
    isCustomer ? account?.address || "" : ""
  );

  // UI state
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);

  // Track recently viewed for customers
  useEffect(() => {
    if (id && isCustomer && serviceData && !isLoading) {
      trackView(id);
    }
  }, [id, isCustomer, serviceData, isLoading]);

  // Fetch reviews
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    refetch: refetchReviews,
  } = useQuery({
    queryKey: queryKeys.serviceReviews(id!),
    queryFn: async () => {
      const result = await serviceApi.getServiceReviews(id!, { limit: 50 });
      return result;
    },
    enabled: !!id,
  });

  const reviews = reviewsData?.data || [];

  // Compute stats from reviews if not provided by API
  const reviewStats = reviewsData?.stats || (reviews.length > 0 ? {
    totalReviews: reviews.length,
    averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
    ratingDistribution: {
      1: reviews.filter(r => r.rating === 1).length,
      2: reviews.filter(r => r.rating === 2).length,
      3: reviews.filter(r => r.rating === 3).length,
      4: reviews.filter(r => r.rating === 4).length,
      5: reviews.filter(r => r.rating === 5).length,
    }
  } : null);

  // Tier & Rewards (customer only)
  const getTierInfo = (): TierInfo => {
    const tier = customerData?.customer?.tier || "bronze";
    const tierBenefits = customerData?.tierBenefits;
    const config = TIER_CONFIG[tier.toLowerCase()] || TIER_CONFIG.bronze;
    const tierBonus = tierBenefits?.tierBonus ?? config.bonus;

    return {
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      ...config,
      tierBonus,
    };
  };

  const calculateReward = (): RewardCalculation => {
    if (!serviceData?.priceUsd) return { base: 0, bonus: 0, total: 0 };
    const tierInfo = getTierInfo();
    const price = serviceData.priceUsd;
    const baseReward = price >= 100 ? 25 : price >= 50 ? 10 : 0;
    const bonusReward = tierInfo.tierBonus;
    return {
      base: baseReward,
      bonus: bonusReward,
      total: baseReward + bonusReward,
    };
  };

  // Share functionality
  const appEnv = Constants.expoConfig?.extra?.appEnv;
  const webBaseUrl =
    appEnv === "staging"
      ? "https://staging.repaircoin.ai"
      : "https://repaircoin.ai";
  const getShareUrl = () => `${webBaseUrl}/services/${id}`;

  const getShareMessage = () => {
    if (!serviceData) return "";
    return `Check out ${serviceData.serviceName} at ${serviceData.shopName} - $${serviceData.priceUsd}`;
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(getShareUrl());
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
      setShowShareModal(false);
    }, COPY_FEEDBACK_DURATION);
  };

  const handleShareWhatsApp = async () => {
    const message = `${getShareMessage()}\n${getShareUrl()}`;
    // wa.me is a universal link: opens the WhatsApp app if installed, web otherwise.
    // It works without the custom scheme being whitelisted, so use it as the fallback.
    const appUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const webUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpen ? appUrl : webUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        Alert.alert("Unable to Share", "Could not open WhatsApp on this device.");
      }
    }
    setShowShareModal(false);
  };

  const handleShareTwitter = async () => {
    const message = getShareMessage();
    const shareUrl = getShareUrl();
    const url = `twitter://post?message=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
    const canOpen = await Linking.canOpenURL(url);
    await Linking.openURL(canOpen ? url : webUrl);
    setShowShareModal(false);
  };

  const handleShareFacebook = async () => {
    setShowShareModal(false);
    const shareUrl = getShareUrl();
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    await WebBrowser.openBrowserAsync(fbUrl);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `${getShareMessage()}\n${getShareUrl()}`,
        url: getShareUrl(),
        title: serviceData?.serviceName || "Check out this service",
      });
    } catch (err) {
      console.error("Error sharing:", err);
    }
    setShowShareModal(false);
  };

  // Utility functions
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

  const formatTime = (time: string | null | undefined) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Availability helpers (shop only)
  const getTodayAvailability = () => {
    const today = new Date().getDay();
    return availability.find((d) => d.dayOfWeek === today);
  };

  const getGroupedHours = () => {
    if (!availability.length) return [];

    const groups: Array<{
      days: number[];
      isOpen: boolean;
      openTime?: string | null;
      closeTime?: string | null;
    }> = [];

    let currentGroup: (typeof groups)[0] | null = null;

    availability.forEach((day) => {
      if (
        currentGroup &&
        ((currentGroup.isOpen === day.isOpen &&
          currentGroup.openTime === day.openTime &&
          currentGroup.closeTime === day.closeTime) ||
          (!currentGroup.isOpen && !day.isOpen))
      ) {
        currentGroup.days.push(day.dayOfWeek);
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          days: [day.dayOfWeek],
          isOpen: day.isOpen,
          openTime: day.openTime,
          closeTime: day.closeTime,
        };
      }
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  };

  const formatDayRange = (days: number[]) => {
    if (days.length === 1) return FULL_DAYS[days[0]];
    if (days.length === 7) return "Every day";

    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const isConsecutive = days.every(
      (day, i) => i === 0 || day === days[i - 1] + 1
    );

    if (isConsecutive && days.length > 2) {
      return `${shortDays[days[0]]} - ${shortDays[days[days.length - 1]]}`;
    }

    return days.map((d) => shortDays[d]).join(", ");
  };

  const openDaysCount = availability.filter((d) => d.isOpen).length;

  // Customer actions
  const handleCall = () => {
    if (serviceData?.shopPhone) {
      Linking.openURL(`tel:${serviceData.shopPhone}`);
    }
  };

  const handleEmail = () => {
    if (serviceData?.shopEmail) {
      Linking.openURL(`mailto:${serviceData.shopEmail}`);
    }
  };

  const handleBookNow = () => {
    router.push(`/customer/appointment/${id}` as any);
  };

  const handleViewShop = () => {
    if (serviceData?.shopId) {
      router.push(`/customer/profile/shop-profile/${serviceData.shopId}` as any);
    }
  };

  const handleMessageShop = async () => {
    if (!serviceData?.shopId || isStartingChat || !account?.address) return;

    setIsStartingChat(true);
    try {
      const initialMessage =
        `Hi! I'm interested in your service "${serviceData.serviceName}".\n\n` +
        `📍 Service: ${serviceData.serviceName}\n` +
        `💰 Price: $${serviceData.priceUsd}\n` +
        `📂 Category: ${getCategoryLabel(serviceData.category)}\n\n` +
        `Could you provide more details?`;

      const response = await messageApi.getConversations();
      const existingConversation = response.data?.find(
        (conv) => conv.shopId === serviceData.shopId
      );

      if (existingConversation) {
        await messageApi.sendMessage({
          conversationId: existingConversation.conversationId,
          messageText: initialMessage,
          messageType: "service_link",
          metadata: {
            serviceId: serviceData.serviceId,
            serviceName: serviceData.serviceName,
            serviceImage: serviceData.imageUrl,
            servicePrice: serviceData.priceUsd,
            serviceCategory: serviceData.category,
            shopName: serviceData.shopName,
          },
        });
        router.push(`/customer/messages/${existingConversation.conversationId}` as any);
      } else {
        const newMessage = await messageApi.sendMessage({
          shopId: serviceData.shopId,
          customerAddress: account.address,
          messageText: initialMessage,
          messageType: "service_link",
          metadata: {
            serviceId: serviceData.serviceId,
            serviceName: serviceData.serviceName,
            serviceImage: serviceData.imageUrl,
            servicePrice: serviceData.priceUsd,
            serviceCategory: serviceData.category,
            shopName: serviceData.shopName,
          },
        });
        if (newMessage.data?.conversationId) {
          router.push(`/customer/messages/${newMessage.data.conversationId}` as any);
        }
      }
    } catch (err) {
      console.error("Failed to start chat:", err);
    } finally {
      setIsStartingChat(false);
    }
  };

  // Shop actions
  const handleEdit = () => {
    if (serviceData) {
      navigateToEdit(serviceData);
    }
  };

  const deleteServiceMutation = useDeleteServiceMutation();
  const handleDeleteService = () => {
    if (!serviceData || !id) return;
    Alert.alert(
      "Delete Service",
      `Delete "${serviceData.serviceName}"? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteServiceMutation.mutate(
              { serviceId: id },
              { onSuccess: () => goBack() }
            ),
        },
      ]
    );
  };

  // Navigation
  const handleGoBack = () => {
    goBack();
  };

  const handleViewAllReviews = () => {
    if (isShopOwner) {
      router.push(`/shop/service/${id}/reviews` as any);
    } else {
      router.push(`/customer/review/service/${id}` as any);
    }
  };

  return {
    // Core data
    id,
    serviceData,
    isLoading,
    error,

    // Role flags
    isCustomer,
    isShop,
    isShopOwner,

    // Reviews
    reviews,
    reviewStats,
    isLoadingReviews,
    refetchReviews,
    handleViewAllReviews,

    // Customer-specific
    getTierInfo,
    calculateReward,
    isStartingChat,
    handleCall,
    handleEmail,
    handleBookNow,
    handleViewShop,
    handleMessageShop,

    // Shop-specific
    availability,
    timeSlotConfig,
    loadingAvailability,
    showAllHours,
    setShowAllHours,
    getTodayAvailability,
    getGroupedHours,
    formatDayRange,
    openDaysCount,
    handleEdit,
    handleDeleteService,
    deleteIsPending: deleteServiceMutation.isPending,

    // Shared
    showShareModal,
    setShowShareModal,
    copySuccess,
    handleCopyLink,
    handleShareWhatsApp,
    handleShareTwitter,
    handleShareFacebook,
    handleNativeShare,
    handleGoBack,
    getCategoryLabel,
    formatDate,
    formatTime,
  };
}
