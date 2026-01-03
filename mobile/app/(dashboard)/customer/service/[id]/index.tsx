import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Share,
  Modal,
  Pressable,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons, Feather } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams, router } from "expo-router";
import { useService } from "@/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { useCustomer } from "@/hooks/customer/useCustomer";
import { useAuthStore } from "@/store/auth.store";

export default function ServiceDetail() {
  const { id, orderId, bookingStatus, hasReview } = useLocalSearchParams<{
    id: string;
    orderId?: string;
    bookingStatus?: string;
    hasReview?: string;
  }>();

  // Check if this is a completed booking (coming from bookings tab) and not already reviewed
  const isCompletedBooking = bookingStatus?.toLowerCase() === "completed";
  const alreadyReviewed = hasReview === "true";
  const canWriteReview = isCompletedBooking && !alreadyReviewed;
  const { useGetService } = useService();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Get customer tier info
  const { account } = useAuthStore();
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { data: customerData } = useGetCustomerByWalletAddress(account?.address || "");

  // Calculate RCN rewards based on tier
  const getTierInfo = () => {
    const tier = customerData?.customer?.tier || "bronze";
    const tierBenefits = customerData?.tierBenefits;

    const tierConfig: Record<string, { color: string; bgColor: string; icon: string; bonus: number }> = {
      bronze: { color: "#CD7F32", bgColor: "bg-amber-900/30", icon: "medal-outline", bonus: 0 },
      silver: { color: "#C0C0C0", bgColor: "bg-gray-500/30", icon: "medal-outline", bonus: 2 },
      gold: { color: "#FFD700", bgColor: "bg-yellow-500/30", icon: "medal-outline", bonus: 5 },
    };

    const config = tierConfig[tier.toLowerCase()] || tierConfig.bronze;
    const tierBonus = tierBenefits?.tierBonus ?? config.bonus;

    return {
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      ...config,
      tierBonus,
    };
  };

  const calculateReward = () => {
    if (!serviceData?.priceUsd) return { base: 0, bonus: 0, total: 0 };
    const tierInfo = getTierInfo();
    // Base reward: 1 RCN per $10 spent (adjustable)
    const baseReward = Math.floor(serviceData.priceUsd / 10);
    const bonusReward = tierInfo.tierBonus;
    return {
      base: baseReward,
      bonus: bonusReward,
      total: baseReward + bonusReward,
    };
  };

  // Generate share URL and message
  const getShareUrl = () => {
    // Replace with your actual deep link or web URL
    return `https://repaircoin.app/service/${id}`;
  };

  const getShareMessage = () => {
    if (!serviceData) return "";
    return `Check out ${serviceData.serviceName} at ${serviceData.shopName} - $${serviceData.priceUsd}`;
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
    router.push(`/customer/booking/${id}`);
  };

  const handleWriteReview = () => {
    if (orderId) {
      const params = new URLSearchParams({
        serviceId: id || "",
        serviceName: serviceData?.serviceName || "",
        shopName: serviceData?.shopName || "",
      });
      router.push(`/customer/review/${orderId}?${params.toString()}` as any);
    }
  };

  const handleViewShop = () => {
    if (serviceData?.shopId) {
      router.push(`/shared/profile/view-profile/${serviceData.shopId}`);
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

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* Shop Information */}
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons
                name="storefront-outline"
                size={22}
                color="#FFCC00"
                style={{ marginRight: 8 }}
              />
              <Text className="text-white text-lg font-semibold">
                Shop Information
              </Text>
            </View>

            {/* Shop Name */}
            {serviceData.shopName && (
              <View className="flex-row items-center mb-3">
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons
                    name="storefront-outline"
                    size={20}
                    color="#FFCC00"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Shop Name</Text>
                  <Text className="text-white text-base">
                    {serviceData.shopName}
                  </Text>
                </View>
              </View>
            )}

            {/* Shop Address */}
            {serviceData.shopAddress && (
              <View className="flex-row items-center mb-3">
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="location-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Address</Text>
                  <Text className="text-white text-base">
                    {serviceData.shopAddress}
                  </Text>
                </View>
              </View>
            )}

            {/* Shop Phone */}
            {serviceData.shopPhone && (
              <TouchableOpacity
                onPress={handleCall}
                className="flex-row items-center mb-3"
              >
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="call-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Phone</Text>
                  <Text className="text-[#FFCC00] text-base">
                    {serviceData.shopPhone}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}

            {/* Shop Email */}
            {serviceData.shopEmail && (
              <TouchableOpacity
                onPress={handleEmail}
                className="flex-row items-center mb-3"
              >
                <View className="bg-gray-800 rounded-full p-2 mr-3">
                  <Ionicons name="mail-outline" size={20} color="#FFCC00" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Email</Text>
                  <Text className="text-[#FFCC00] text-base">
                    {serviceData.shopEmail}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View className="h-px bg-gray-800 mb-6" />

          {/* RCN Rewards Section */}
          <View className="mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="gift-outline" size={22} color="#FFCC00" />
              <Text className="text-white text-lg font-semibold ml-2">
                RCN Rewards
              </Text>
            </View>

            {/* Tier Badge & Rewards Card */}
            <View className="bg-[#1a1a1a] rounded-xl p-4">
              {/* Your Tier */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${getTierInfo().bgColor}`}>
                    <Ionicons name="medal" size={22} color={getTierInfo().color} />
                  </View>
                  <View>
                    <Text className="text-gray-500 text-xs">Your Tier</Text>
                    <Text className="text-white font-semibold" style={{ color: getTierInfo().color }}>
                      {getTierInfo().tier}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-gray-500 text-xs">Tier Bonus</Text>
                  <Text className="text-[#FFCC00] font-bold">+{getTierInfo().tierBonus} RCN</Text>
                </View>
              </View>

              {/* Divider */}
              <View className="h-px bg-gray-800 mb-4" />

              {/* Reward Breakdown */}
              <View className="mb-3">
                <Text className="text-gray-400 text-sm mb-3">Potential Earnings</Text>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-500">Base Reward</Text>
                  <Text className="text-white">{calculateReward().base} RCN</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-gray-500">Tier Bonus ({getTierInfo().tier})</Text>
                  <Text className="text-green-400">+{calculateReward().bonus} RCN</Text>
                </View>
                <View className="h-px bg-gray-700 my-2" />
                <View className="flex-row justify-between">
                  <Text className="text-white font-semibold">Total Reward</Text>
                  <Text className="text-[#FFCC00] font-bold text-lg">{calculateReward().total} RCN</Text>
                </View>
              </View>

              {/* Info Note */}
              <View className="bg-[#FFCC00]/10 rounded-lg p-3 flex-row items-start">
                <Ionicons name="information-circle" size={18} color="#FFCC00" />
                <Text className="text-gray-400 text-xs ml-2 flex-1">
                  Earn RCN tokens when you complete this service. Higher tiers unlock better rewards!
                </Text>
              </View>
            </View>
          </View>

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

            <View className="flex-row items-center">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="calendar-outline" size={20} color="#FFCC00" />
              </View>
              <View>
                <Text className="text-gray-500 text-xs">Listed On</Text>
                <Text className="text-white text-base">
                  {formatDate(serviceData.createdAt)}
                </Text>
              </View>
            </View>
          </View>

          {/* Spacer for bottom button */}
          <View className="h-24" />
        </View>
      </ScrollView>

      {/* Fixed Bottom Buttons */}
      <View className="absolute bottom-0 left-0 right-0 bg-zinc-950 px-4 py-4 border-t border-gray-800 pb-8">
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleViewShop}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl py-4 items-center flex-row justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="storefront-outline" size={20} color="#FFCC00" />
            <Text className="text-white text-lg font-bold ml-2">View Shop</Text>
          </TouchableOpacity>
          {canWriteReview ? (
            <TouchableOpacity
              onPress={handleWriteReview}
              className="flex-1 bg-[#FFCC00] rounded-xl py-4 items-center flex-row justify-center"
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={20} color="black" />
              <Text className="text-black text-lg font-bold ml-2">Review</Text>
            </TouchableOpacity>
          ) : alreadyReviewed ? (
            <View className="flex-1 bg-green-500/20 rounded-xl py-4 items-center flex-row justify-center">
              <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
              <Text className="text-green-500 text-lg font-bold ml-2">Reviewed</Text>
            </View>
          ) : (
            serviceData.active && (
              <TouchableOpacity
                onPress={handleBookNow}
                className="flex-1 bg-[#FFCC00] rounded-xl py-4 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-black text-lg font-bold">Book Now</Text>
              </TouchableOpacity>
            )
          )}
        </View>
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
