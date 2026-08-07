import Badge from "@/shared/components/ui/Badge";
import { CAMPAIGN_STATUS_TONE } from "../constants/marketingConstants";
import { CampaignDisplayStatus } from "../services/marketing.interface";

const STATUS_LABELS: Record<CampaignDisplayStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sent: "Sent",
  active: "Active",
  cancelled: "Cancelled",
};

export function CampaignStatusBadge({ status }: { status: CampaignDisplayStatus }) {
  return <Badge label={STATUS_LABELS[status]} tone={CAMPAIGN_STATUS_TONE[status]} icon={null} size="md" />;
}
