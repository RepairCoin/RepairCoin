import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StatCard from "@/shared/components/ui/StatCard";
import { MarketingCampaign } from "../services/marketing.interface";

function icon(name: keyof typeof Ionicons.glyphMap) {
  return <Ionicons name={name} size={16} color="#000" />;
}

/** Delivery-result breakdown shown once a campaign has actually sent. */
export function CampaignStatsGrid({ campaign }: { campaign: MarketingCampaign }) {
  const openRate =
    campaign.emailsSent > 0 ? `${Math.round((campaign.emailsOpened / campaign.emailsSent) * 100)}%` : "—";

  return (
    <View>
      <View className="flex-row -mx-1 mb-2">
        <StatCard value={campaign.totalRecipients} label="Recipients" icon={icon("people-outline")} />
        <StatCard value={campaign.emailsSent} label="Emails sent" icon={icon("mail-outline")} />
      </View>
      <View className="flex-row -mx-1">
        <StatCard value={openRate} label="Open rate" icon={icon("eye-outline")} />
        <StatCard value={campaign.inAppRead} label="In-app read" icon={icon("notifications-outline")} />
      </View>
    </View>
  );
}
