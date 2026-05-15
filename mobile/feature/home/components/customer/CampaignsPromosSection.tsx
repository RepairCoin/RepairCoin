import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { notificationApi } from "@/feature/notification/services/notification.services";
import { Notification } from "@/shared/interfaces/notification.interface";
import CampaignCard from "./CampaignCard";

interface CampaignsPromosSectionProps {
  refreshKey?: number;
}

export default function CampaignsPromosSection({ refreshKey }: CampaignsPromosSectionProps) {
  const [campaigns, setCampaigns] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchCampaigns() {
      try {
        setIsLoading(true);
        const response = await notificationApi.getNotifications(1, 50);
        if (cancelled) return;

        const marketingCampaigns = (response.items || [])
          .filter((n) => n.notificationType === "marketing_campaign")
          .slice(0, 3);

        setCampaigns(marketingCampaigns);
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchCampaigns();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleCampaignPress = (notification: Notification) => {
    router.push(`/customer/campaign/${notification.id}`);
  };

  if (isLoading) {
    return (
      <View className="mt-5 items-center py-6">
        <ActivityIndicator size="small" color="#FFCC00" />
      </View>
    );
  }

  if (campaigns.length === 0) {
    return null;
  }

  return (
    <View className="mt-5">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <MaterialCommunityIcons name="bullhorn" size={22} color="#FFCC00" />
        <Text className="text-white text-xl font-bold ml-1">
          Campaigns & Promos
        </Text>
      </View>

      {/* Campaign Cards */}
      <View className="gap-2">
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            notification={campaign}
            onPress={handleCampaignPress}
          />
        ))}
      </View>
    </View>
  );
}
