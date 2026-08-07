// Transliterated from frontend/src/services/api/marketing.ts (campaigns/templates/stats/audience/
// customers) and backend/src/repositories/ContactRepository.ts (contacts). NO `aiDraftCampaign` —
// no AI anywhere in mobile marketing.
//
// apiClient (shared/utilities/axios.ts) returns the WHOLE `{success, data}` envelope — web's axios
// interceptor strips one level, mobile's doesn't — so every response type here wraps its payload in
// `{ success, data }` (or `{ success, message }` for the delete-style endpoints) rather than being
// the bare payload the frontend client types describe.

// ==================== Campaigns ====================

export type CampaignType = "announce_service" | "offer_coupon" | "newsletter" | "custom";
export type CampaignStatus = "draft" | "scheduled" | "sent" | "cancelled";
export type CampaignDisplayStatus = "draft" | "scheduled" | "sent" | "active" | "cancelled";
export type CampaignAudienceType =
  | "all_customers"
  | "select_customers"
  | "top_spenders"
  | "frequent_visitors"
  | "active_customers"
  | "custom";
export type CampaignDeliveryMethod = "email" | "in_app" | "both";

export interface CampaignRewardSummary {
  pending: number;
  redeemed: number;
  expired: number;
  issued: number;
  failed: number;
  skipped: number;
}

export interface MarketingCampaign {
  id: string;
  shopId: string;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  subject: string | null;
  previewText: string | null;
  designContent: Record<string, any>;
  templateId: string | null;
  audienceType: CampaignAudienceType;
  audienceFilters: Record<string, any>;
  deliveryMethod: CampaignDeliveryMethod;
  scheduledAt: string | null;
  sentAt: string | null;
  promoCodeId: number | null;
  couponValue: number | null;
  couponType: "fixed" | "percentage" | null;
  couponExpiresAt: string | null;
  serviceId: string | null;
  // Campaign Rewards — read-only on mobile (see useCampaignMutations). Never omit-safe to write:
  // mobile never sends a `reward` key on update, so these always reflect the web-configured value.
  rewardType: "none" | "rcn" | "coupon";
  rewardMode: "flat" | "by_tier" | "by_spend" | null;
  rewardRcnAmount: number | null;
  rewardRcnByTier: Record<string, number> | null;
  rewardSpendBands: { minSpend: number; rcn: number }[] | null;
  fulfillmentTrigger: "on_send" | "on_return";
  returnWindowDays: number | null;
  totalRecipients: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  inAppSent: number;
  inAppRead: number;
  createdAt: string;
  updatedAt: string;
  rewardSummary?: CampaignRewardSummary;
  displayStatus?: CampaignDisplayStatus;
}

export interface CampaignReward {
  type: "none" | "rcn" | "coupon";
  mode?: "flat" | "by_tier" | "by_spend";
  rcnAmount?: number;
  rcnByTier?: Record<string, number>;
  spendBands?: { minSpend: number; rcn: number }[];
  fulfillment?: "on_send" | "on_return";
  returnWindowDays?: number;
  couponValue?: number;
  couponExpiresDays?: number;
}

export interface MarketingTemplate {
  id: string;
  name: string;
  description: string | null;
  category: "coupon" | "announcement" | "newsletter" | "event";
  thumbnailUrl: string | null;
  designContent: Record<string, any>;
  isActive: boolean;
  createdAt: string;
}

export interface CampaignStats {
  totalCampaigns: number;
  draftCampaigns: number;
  sentCampaigns: number;
  totalEmailsSent: number;
  totalEmailsOpened: number;
  totalInAppSent: number;
  totalInAppRead: number;
  avgOpenRate: number;
}

export interface CreateCampaignData {
  name: string;
  campaignType: CampaignType;
  subject?: string;
  previewText?: string;
  designContent?: Record<string, any>;
  templateId?: string;
  audienceType?: CampaignAudienceType;
  audienceFilters?: Record<string, any>;
  deliveryMethod?: CampaignDeliveryMethod;
  promoCodeId?: number;
  couponValue?: number;
  couponType?: "fixed" | "percentage";
  couponExpiresAt?: string;
  serviceId?: string;
  manualEmails?: string;
  // NEVER send this on update: omitted = no-op server-side, but an explicit null/{type:'none'}
  // would silently CLEAR a reward configured on web. Mobile only ever reads this field.
  reward?: CampaignReward | null;
}

export type UpdateCampaignData = Partial<CreateCampaignData>;

export interface CampaignDeliveryResult {
  totalRecipients: number;
  emailsSent: number;
  emailsFailed: number;
  inAppSent: number;
  inAppFailed: number;
  rcnIssued?: number;
  rcnSkipped?: number;
  rcnFailed?: number;
  rcnTotalIssued?: number;
  rcnPending?: number;
}

export interface CampaignPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CampaignsPage {
  items: MarketingCampaign[];
  pagination: CampaignPagination;
}

export interface GetCampaignsResponse {
  success: boolean;
  data: CampaignsPage;
}

export interface CampaignResponse {
  success: boolean;
  data: MarketingCampaign;
  meta?: { manualEmailsAdded: number };
}

export interface DeleteCampaignResponse {
  success: boolean;
  message: string;
}

export interface SendCampaignResponse {
  success: boolean;
  data: CampaignDeliveryResult;
}

export interface CampaignStatsResponse {
  success: boolean;
  data: CampaignStats;
}

export interface AudienceCountResponse {
  success: boolean;
  data: { count: number };
}

export interface MarketingTemplatesResponse {
  success: boolean;
  data: MarketingTemplate[];
}

export interface MarketingTemplateResponse {
  success: boolean;
  data: MarketingTemplate;
}

// ==================== Marketing customers (audience targeting) ====================

export interface MarketingCustomer {
  walletAddress: string;
  email?: string;
  name?: string;
  tier?: string;
  totalSpent?: number;
  visitCount?: number;
  lastVisit?: string;
}

export interface MarketingCustomersPage {
  customers: MarketingCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MarketingCustomersResponse {
  success: boolean;
  data: MarketingCustomersPage;
}

// ==================== Contacts ====================

export type ContactStatus = "active" | "unsubscribed" | "bounced" | "invalid";
export type ContactSource = "manual" | "csv" | "api";

export interface Contact {
  id: string;
  shopId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
  source: ContactSource;
  tags: string[];
  notes: string | null;
  emailSentCount: number;
  smsSentCount: number;
  lastEmailSentAt: string | null;
  lastSmsSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactData {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface UpdateContactData {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  status?: ContactStatus;
  tags?: string[];
  notes?: string | null;
}

export interface ContactStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
  invalid: number;
  withEmail: number;
  withPhone: number;
  totalEmailsSent: number;
  totalSmsSent: number;
}

export interface ContactsPage {
  contacts: Contact[];
  total: number;
}

export interface GetContactsResponse {
  success: boolean;
  data: ContactsPage;
}

export interface ContactResponse {
  success: boolean;
  data: Contact;
}

export interface DeleteContactResponse {
  success: boolean;
  message: string;
}

export interface ContactStatsResponse {
  success: boolean;
  data: ContactStats;
}

export interface SendContactEmailResult {
  contactId: string;
  email: string;
  status: "sent" | "failed";
}

export interface SendContactEmailCampaignResponse {
  success: boolean;
  data: {
    totalRecipients: number;
    sent: number;
    failed: number;
    results: SendContactEmailResult[];
  };
}

export interface SendTestEmailResponse {
  success: boolean;
  message: string;
}
