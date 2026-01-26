import { useState } from "react";
import { Linking, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { useService } from "@/shared/service/useService";
import { useCustomer } from "@/shared/customer/useCustomer";
import { useAuthStore } from "@/store/auth.store";
import { messageApi } from "@/services/message.services";
import { SERVICE_CATEGORIES } from "@/constants/service-categories";
import { TIER_CONFIG, REWARD_RATE, COPY_FEEDBACK_DURATION } from "../../constants";
import { TierInfo, RewardCalculation } from "../../types";

export function useServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { useGetService } = useService();
  const { data: serviceData, isLoading, error } = useGetService(id!);

  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);

  const { account, userType } = useAuthStore();
  const isCustomer = userType === "customer";
  const { useGetCustomerByWalletAddress } = useCustomer();
  const { data: customerData } = useGetCustomerByWalletAddress(account?.address || "");

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
    const baseReward = Math.floor(serviceData.priceUsd / REWARD_RATE);
    const bonusReward = tierInfo.tierBonus;
    return {
      base: baseReward,
      bonus: bonusReward,
      total: baseReward + bonusReward,
    };
  };

  const getShareUrl = () => {
    return "https://repaircoin.app/service/" + id;
  };

  const getShareMessage = () => {
    if (!serviceData) return "";
    return "Check out " + serviceData.serviceName + " at " + serviceData.shopName + " - $" + serviceData.priceUsd;
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
    const message = getShareMessage() + "\n" + getShareUrl();
    const url = "whatsapp://send?text=" + encodeURIComponent(message);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) await Linking.openURL(url);
    setShowShareModal(false);
  };

  const handleShareTwitter = async () => {
    const message = getShareMessage();
    const shareUrl = getShareUrl();
    const url = "twitter://post?message=" + encodeURIComponent(message) + "&url=" + encodeURIComponent(shareUrl);
    const webUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(message) + "&url=" + encodeURIComponent(shareUrl);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      await Linking.openURL(webUrl);
    }
    setShowShareModal(false);
  };

  const handleShareFacebook = async () => {
    const url = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(getShareUrl());
    await Linking.openURL(url);
    setShowShareModal(false);
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: getShareMessage() + "\n" + getShareUrl(),
        url: getShareUrl(),
        title: serviceData?.serviceName || "Check out this service",
      });
    } catch (err) {
      console.error("Error sharing:", err);
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
      Linking.openURL("tel:" + serviceData.shopPhone);
    }
  };

  const handleEmail = () => {
    if (serviceData?.shopEmail) {
      Linking.openURL("mailto:" + serviceData.shopEmail);
    }
  };

  const handleBookNow = () => {
    router.push("/customer/appointment/" + id as any);
  };

  const handleViewShop = () => {
    if (serviceData?.shopId) {
      router.push("/customer/profile/shop-profile/" + serviceData.shopId as any);
    }
  };

  const handleMessageShop = async () => {
    if (!serviceData?.shopId || isStartingChat || !account?.address) return;

    setIsStartingChat(true);
    try {
      const initialMessage = "Hi! I'm interested in your service \"" + serviceData.serviceName + "\".\n\n" +
        "📍 Service: " + serviceData.serviceName + "\n" +
        "💰 Price: $" + serviceData.priceUsd + "\n" +
        "📂 Category: " + getCategoryLabel(serviceData.category) + "\n\n" +
        "Could you provide more details?";

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
        router.push("/customer/messages/" + existingConversation.conversationId as any);
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
          router.push("/customer/messages/" + newMessage.data.conversationId as any);
        }
      }
    } catch (err) {
      console.error("Failed to start chat:", err);
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleGoBack = () => {
    goBack();
  };

  return {
    id,
    serviceData,
    isLoading,
    error,
    isCustomer,
    getTierInfo,
    calculateReward,
    showShareModal,
    setShowShareModal,
    copySuccess,
    handleCopyLink,
    handleShareWhatsApp,
    handleShareTwitter,
    handleShareFacebook,
    handleNativeShare,
    isStartingChat,
    handleCall,
    handleEmail,
    handleBookNow,
    handleViewShop,
    handleMessageShop,
    handleGoBack,
    getCategoryLabel,
    formatDate,
  };
}
