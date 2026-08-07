import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/shared/utilities/format";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { CAMPAIGN_TYPE_LABELS } from "../constants/marketingConstants";
import { MarketingCampaign } from "../services/marketing.interface";

const DELIVERY_ICON: Record<MarketingCampaign["deliveryMethod"], keyof typeof Ionicons.glyphMap> = {
  email: "mail-outline",
  in_app: "notifications-outline",
  both: "megaphone-outline",
};

export function CampaignCard({
  campaign,
  onPress,
}: {
  campaign: MarketingCampaign;
  onPress: () => void;
}) {
  const status = campaign.displayStatus ?? campaign.status;
  const dateLabel =
    campaign.status === "sent" && campaign.sentAt
      ? `Sent ${formatDate(campaign.sentAt)}`
      : campaign.status === "scheduled" && campaign.scheduledAt
      ? `Scheduled ${formatDate(campaign.scheduledAt)}`
      : `Created ${formatDate(campaign.createdAt)}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-[#1A1A1A] rounded-2xl p-4 mb-3 border border-[#222]"
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-white text-base font-bold flex-1 mr-3" numberOfLines={1}>
          {campaign.name}
        </Text>
        <CampaignStatusBadge status={status} />
      </View>

      <Text className="text-gray-400 text-xs mb-3">{CAMPAIGN_TYPE_LABELS[campaign.campaignType]}</Text>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name={DELIVERY_ICON[campaign.deliveryMethod]} size={14} color="#9CA3AF" />
          <Text className="text-gray-500 text-xs ml-1.5">{dateLabel}</Text>
        </View>
        {campaign.status === "sent" && (
          <Text className="text-gray-400 text-xs">
            {campaign.totalRecipients.toLocaleString()} recipient{campaign.totalRecipients !== 1 ? "s" : ""}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
