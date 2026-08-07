import { BadgeTone } from "@/shared/components/ui/Badge";
import {
  CampaignAudienceType,
  CampaignDeliveryMethod,
  CampaignDisplayStatus,
  CampaignType,
  ContactStatus,
} from "../services/marketing.interface";

// ≤ this many recipients → POST /send (sync, immediate). Above it → POST /schedule at now+60s,
// which the server's every-minute cron picks up — immune to the phone sleeping mid-send.
export const SEND_NOW_MAX_RECIPIENTS = 25;

// Contact blast has no scheduler equivalent (it's a direct, synchronous email loop), so it stays
// hard-capped rather than routed through the campaign scheduler. Larger sends go through web.
export const CONTACT_BLAST_MAX = 50;

// Matches the server's SLOW_AI_PATHS-style allowance for a serial, unqueued send loop — comfortably
// above axios's default 60s so a real (small) blast doesn't get client-timed-out mid-send.
export const SEND_TIMEOUT_MS = 120000;

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  announce_service: "Announce a service",
  offer_coupon: "Offer a coupon",
  newsletter: "Newsletter",
  custom: "Custom",
};

export const CAMPAIGN_STATUS_TONE: Record<CampaignDisplayStatus, BadgeTone> = {
  draft: "neutral",
  scheduled: "info",
  sent: "success",
  active: "info",
  cancelled: "danger",
};

export const DELIVERY_METHOD_OPTIONS: { value: CampaignDeliveryMethod; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-app notification" },
  { value: "both", label: "Email + in-app" },
];

// The full `custom` filter builder is deferred — this ships the one preset web supports as
// "Lapsed customers" (see LAPSED_DAY_OPTIONS for the window picker that goes with it).
export const AUDIENCE_OPTIONS: {
  value: CampaignAudienceType;
  label: string;
  description?: string;
}[] = [
  { value: "all_customers", label: "All customers" },
  { value: "active_customers", label: "Active customers", description: "Visited in the last 30 days" },
  { value: "top_spenders", label: "Top spenders", description: "Top 20% by total spend" },
  { value: "frequent_visitors", label: "Frequent visitors", description: "Top 20% by visit count" },
  { value: "select_customers", label: "Select customers", description: "Pick individually" },
  { value: "custom", label: "Lapsed customers", description: "Haven't visited in a while" },
];

export const LAPSED_DAY_OPTIONS = [30, 60, 90] as const;

// Only these block types render as editable FormInputs in the mobile composer; everything else
// (image/coupon/service_card/divider/spacer/unknown) is a locked chip preserved byte-identical.
export const EDITABLE_BLOCK_TYPES = ["headline", "text", "button"] as const;

export const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "invalid", label: "Invalid" },
];
