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
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { goBack } from "expo-router/build/global-state/routing";
import { useLocalSearchParams, router } from "expo-router";
import { useService } from "@/hooks/service/useService";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetService } = useService();
  const { data: serviceData, isLoading, error } = useGetService(id!);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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
            <Text className="text-white text-lg font-semibold mb-4">
              Shop Information
            </Text>

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

          {/* Additional Info */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-4">
              Additional Information
            </Text>

            <View className="flex-row items-center">
              <View className="bg-gray-800 rounded-full p-2 mr-3">
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
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
          {serviceData.active && (
            <TouchableOpacity
              onPress={handleBookNow}
              className="flex-1 bg-[#FFCC00] rounded-xl py-4 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-black text-lg font-bold">Book Now</Text>
            </TouchableOpacity>
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
