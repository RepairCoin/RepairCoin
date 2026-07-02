// frontend/src/services/api/ads.ts
//
// Client for the Ads System (/api/ads). Admin manages campaigns + enters daily
// metrics; shops read their own campaigns + performance. The axios interceptor
// pre-unwraps response.data, so call sites read response.data.<key>.

import apiClient from './client';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
export type LeadStatus = 'new' | 'contacted' | 'booked' | 'paid' | 'completed' | 'lost';

export interface AdCampaign {
  id: string;
  shopId: string;
  industryId: number | null;
  name: string;
  platform: string;
  dailyBudgetCents: number;
  status: CampaignStatus;
  objective?: string | null; // OUTCOME_TRAFFIC | OUTCOME_AWARENESS | OUTCOME_ENGAGEMENT (admin picker)
  allowMetaEnhancements?: boolean; // opt-in Meta Advantage+ creative enhancements
  needsCreativeRefresh?: boolean;  // Safeguard 5: underperforming → nudge a free creative swap
  creativeRefreshReason?: string | null;
  isTestBudget?: boolean;          // Safeguard 4: running at the reduced test budget
  fullDailyBudgetCents?: number | null;
  testBudgetUpgradeReady?: boolean; // window passed + ROI ok → nudge scale-up
  aiAgentEnabled: boolean;
  notes: string | null;
  createdAt: string;
  startedAt?: string | null; // set the first time it goes live — distinguishes pre-live drafts
  // Stage-4 push: present when the campaign was created on Meta.
  metaCampaignId?: string | null;
  metaStatus?: string | null; // PAUSED (drafted, awaiting Go-live) | ACTIVE
  // Google plan push: present when the campaign was created on the shop's Google Ads account.
  googleCampaignId?: string | null;
  googleAdGroupId?: string | null;
  googleStatus?: string | null; // PAUSED (drafted, awaiting Go-live) | ENABLED
  targetRadiusMiles?: number | null;
  currency?: string | null; // joined from shops.meta_currency — the connected ad account's currency
}

export interface CampaignRoi {
  totalSpendCents: number;
  totalRevenueCents: number;
  totalLeads: number;
  totalBookings: number;
  roi: number | null;
  roas: number | null;
  cplCents: number | null;
  cpbCents: number | null;
}

export interface PerformanceRow {
  date: string;
  spendCents: number;
  impressions: number;
  clicks: number;
  leadsCaptured: number;
  bookingsCreated: number;
  revenueCents: number;
}

export interface CampaignPerformance {
  campaignId: string;
  roi: CampaignRoi;
  dailyRows: PerformanceRow[];
}

export interface AllShopsSummary {
  totalSpendCents: number;
  totalRevenueCents: number;
  totalLeads: number;
  totalBookings: number;
  campaignCount: number;
}

export interface DailyMetricsPayload {
  date: string; // YYYY-MM-DD
  spendCents?: number;
  impressions?: number;
  clicks?: number;
  leadsCaptured?: number;
  bookingsCreated?: number;
  revenueCents?: number;
}

export interface AdLead {
  id: string;
  campaignId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  leadStatus: LeadStatus;
  attributionMethod: string;
  /** True only for Messenger/WhatsApp leads → enables Chat / AI-reply. Form/manual leads are false. */
  hasChatChannel?: boolean;
  /** First time the shop/admin actually contacted the lead (call/email/status→contacted). Null = never. */
  firstResponseAt?: string | null;
  createdAt: string;
}

export type AdLeadActivityType = 'email' | 'call' | 'note' | 'status_change';

export interface AdLeadActivity {
  id: string;
  leadId: string;
  type: AdLeadActivityType;
  channel: string | null;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  actorAddress: string | null;
  meta: Record<string, any>;
  createdAt: string;
}

const unwrap = <T>(res: any): T => (res.data.data ?? res.data) as T;

/* --------------------------------- Admin --------------------------------- */

export const listCampaigns = async (params?: { shopId?: string; status?: CampaignStatus }) => {
  const res = await apiClient.get('/ads/campaigns', { params });
  return { items: unwrap<AdCampaign[]>(res), total: (res.data.total ?? 0) as number };
};

export const createCampaign = async (input: {
  shopId: string; name: string; industryId?: number | null; platform?: string;
  dailyBudgetCents?: number; aiAgentEnabled?: boolean; notes?: string | null;
}) => {
  const res = await apiClient.post('/ads/campaigns', input);
  return unwrap<AdCampaign>(res);
};

export const updateCampaign = async (id: string, input: Partial<{
  name: string; status: CampaignStatus; dailyBudgetCents: number; notes: string | null;
  aiAgentEnabled: boolean;
}>) => {
  const res = await apiClient.patch(`/ads/campaigns/${id}`, input);
  return unwrap<AdCampaign>(res);
};

export const deleteCampaign = async (id: string) => {
  await apiClient.delete(`/ads/campaigns/${id}`);
};

export const getCampaignPerformance = async (id: string) => {
  const res = await apiClient.get(`/ads/campaigns/${id}/performance`);
  return unwrap<CampaignPerformance>(res);
};

export const enterDailyMetrics = async (id: string, payload: DailyMetricsPayload) => {
  const res = await apiClient.post(`/ads/campaigns/${id}/metrics`, payload);
  return unwrap<CampaignPerformance>(res);
};

export const getAllShopsSummary = async () => {
  const res = await apiClient.get('/ads/analytics/summary');
  return unwrap<AllShopsSummary>(res);
};

// Q6 — admin-only "true margin": shop-facing ROI vs ROI with AI COGS folded in.
// NEVER shown to shops.
export interface CampaignMargin {
  totalSpendCents: number;
  totalRevenueCents: number;
  aiCostCents: number;     // fractional cents
  shopRoi: number | null;  // excludes AI cost (what the shop sees)
  trueRoi: number | null;  // includes AI cost in the denominator
  roiDip: number | null;   // shopRoi - trueRoi
}
export type MarginSummary = CampaignMargin & { campaignCount: number };

export const getCampaignMargin = async (id: string): Promise<CampaignMargin> => {
  const res = await apiClient.get(`/ads/campaigns/${id}/margin`);
  return unwrap<CampaignMargin>(res);
};
export const getMarginSummary = async (): Promise<MarginSummary> => {
  const res = await apiClient.get('/ads/analytics/margin');
  return unwrap<MarginSummary>(res);
};

/* ----------------------- Ad-management billing (Q4/Q7) ------------------- */
// Plan A/B/C ride on top of the $500/mo base subscription. Admin-only.

export type AdPlanType = 'a' | 'b' | 'c' | 'flat';
export type PlanCModel = 'per_booking' | 'revenue_share';
export type FlatTierName = 'starter' | 'growth' | 'business';

// The live flat tiers (Decision 2026-06-15). a/b/c are legacy/dormant.
export const FLAT_TIERS: { name: FlatTierName; label: string; feeCents: number; blurb: string }[] = [
  { name: 'starter',  label: 'Starter — $199/mo',  feeCents: 19900, blurb: 'Facebook · 1 campaign · you reply to leads' },
  { name: 'growth',   label: 'Growth — $499/mo',   feeCents: 49900, blurb: 'FB + Instagram · 3 campaigns · AI answers leads' },
  { name: 'business', label: 'Business — $999/mo', feeCents: 99900, blurb: 'FB + IG + Google · 10 campaigns · priority' },
];

export interface AdBillingPlan {
  shopId: string;
  planType: AdPlanType;
  markupBps: number;            // Plan B (2000 = 20%) — legacy
  dashboardFeeCents: number;    // Plan A — legacy
  perBookingFeeCents: number;   // Plan C — legacy
  revenueShareBps: number;      // Plan C alt — legacy
  planCModel: PlanCModel;       // legacy
  flatFeeCents: number;         // flat tier monthly fee
  flatTierName: string | null;  // 'starter' | 'growth' | 'business'
  active: boolean;
}

export interface BillingTotals {
  pendingCents: number;
  invoicedCents: number;
  paidCents: number;
  totalCents: number;
}

export interface BillingCharge {
  id: string;
  shopId: string;
  campaignId: string | null;
  periodDate: string;
  chargeType: 'plan_a_dashboard' | 'plan_b_margin' | 'plan_c_booking' | 'plan_c_revenue_share';
  basisCents: number;
  amountCents: number;
  status: 'pending' | 'invoiced' | 'paid' | 'void';
}

export interface InvoicePreview { shopId: string; chargeIds: string[]; totalCents: number; lineCount: number; }

export interface ShopBilling {
  plan: AdBillingPlan;
  totals: BillingTotals;
  recent: BillingCharge[];
  invoicePreview: InvoicePreview;
  stripeEnabled: boolean;
}

export type BillingSummary = BillingTotals & { shopCount: number };

export const getBillingPlan = async (shopId: string): Promise<AdBillingPlan> => {
  const res = await apiClient.get(`/ads/shops/${shopId}/billing-plan`);
  return unwrap<AdBillingPlan>(res);
};
export const setBillingPlan = async (shopId: string, input: Partial<Omit<AdBillingPlan, 'shopId'>>): Promise<AdBillingPlan> => {
  const res = await apiClient.put(`/ads/shops/${shopId}/billing-plan`, input);
  return unwrap<AdBillingPlan>(res);
};
export const getShopBilling = async (shopId: string): Promise<ShopBilling> => {
  const res = await apiClient.get(`/ads/shops/${shopId}/billing`);
  return unwrap<ShopBilling>(res);
};
export const getBillingSummary = async (): Promise<BillingSummary> => {
  const res = await apiClient.get('/ads/analytics/billing');
  return unwrap<BillingSummary>(res);
};
export const triggerAccrual = async (): Promise<void> => {
  await apiClient.post('/ads/billing/accrue');
};
// Gated server-side (501 with an actionable message until Stripe collection is wired).
export const pushShopInvoice = async (shopId: string): Promise<{ stripeInvoiceId: string; totalCents: number }> => {
  const res = await apiClient.post(`/ads/shops/${shopId}/billing/invoice`);
  return unwrap<{ stripeInvoiceId: string; totalCents: number }>(res);
};

// Stage 5 — per-industry comparison
export interface IndustryRow {
  industrySlug: string | null;
  industryName: string;
  totalSpendCents: number;
  totalRevenueCents: number;
  totalLeads: number;
  totalBookings: number;
  campaignCount: number;
  roi: number | null;
  cplCents: number | null;
  cpbCents: number | null;
}
export const getIndustryAnalytics = async (): Promise<IndustryRow[]> => {
  const res = await apiClient.get('/ads/analytics/by-industry');
  return unwrap<IndustryRow[]>(res);
};

// Stage 5 — A/B experiments
export interface AdExperiment {
  id: string; campaignId: string; name: string;
  status: 'running' | 'ended'; winnerCreativeId: string | null;
}
export interface ExperimentArm {
  creativeId: string; headline: string | null;
  leads: number; bookings: number; conversionRate: number | null;
}
export const listExperiments = async (campaignId: string): Promise<AdExperiment[]> => {
  const res = await apiClient.get(`/ads/campaigns/${campaignId}/experiments`);
  return unwrap<AdExperiment[]>(res);
};
export const createExperiment = async (campaignId: string, name: string): Promise<AdExperiment> => {
  const res = await apiClient.post(`/ads/campaigns/${campaignId}/experiments`, { name });
  return unwrap<AdExperiment>(res);
};
export const getExperimentReport = async (id: string): Promise<ExperimentArm[]> => {
  const res = await apiClient.get(`/ads/experiments/${id}/report`);
  return unwrap<ExperimentArm[]>(res);
};
export const setExperimentWinner = async (id: string, creativeId: string): Promise<AdExperiment> => {
  const res = await apiClient.patch(`/ads/experiments/${id}/winner`, { creativeId });
  return unwrap<AdExperiment>(res);
};

/* -------------------------------- Creatives ------------------------------ */
// Q8 — admin creates creatives and reviews (approve/reject) them before launch,
// protecting the SHARED Meta ad account from policy-violating ads.

export type CreativeType = 'image' | 'video' | 'carousel';
export type CreativeReviewStatus = 'pending' | 'approved' | 'rejected';
export type LandingUrlType = 'booking_page' | 'shop_profile' | 'lead_form';

export interface AdCreative {
  id: string;
  campaignId: string;
  creativeType: CreativeType;
  language: string;
  landingUrl: string | null;
  landingUrlType: LandingUrlType | null;
  headline: string | null;
  body: string | null;
  imageUrl: string | null;
  metaCreativeId: string | null;
  generationPrompt: string | null;
  version: number;
  reviewStatus: CreativeReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Two-way sync: the live creative was swapped/edited in Ads Manager and reflected back here,
   *  bypassing FixFlow's review gate. Surfaced as an "Edited in Ads Manager" badge. */
  externallyEdited?: boolean;
  externallyEditedAt?: string | null;
  createdAt: string;
}

export interface CreateCreativeInput {
  creativeType: CreativeType;
  language?: string;
  landingUrl?: string | null;
  landingUrlType?: LandingUrlType | null;
  headline?: string | null;
  body?: string | null;
}

export const listCreatives = async (campaignId: string): Promise<AdCreative[]> => {
  const res = await apiClient.get(`/ads/campaigns/${campaignId}/creatives`);
  return unwrap<AdCreative[]>(res);
};
export const createCreative = async (campaignId: string, input: CreateCreativeInput): Promise<AdCreative> => {
  const res = await apiClient.post(`/ads/campaigns/${campaignId}/creatives`, input);
  return unwrap<AdCreative>(res);
};
export const updateCreative = async (id: string, input: Partial<CreateCreativeInput>): Promise<AdCreative> => {
  const res = await apiClient.patch(`/ads/creatives/${id}`, input);
  return unwrap<AdCreative>(res);
};
export const reviewCreative = async (id: string, status: 'approved' | 'rejected'): Promise<AdCreative> => {
  const res = await apiClient.patch(`/ads/creatives/${id}/review`, { status });
  return unwrap<AdCreative>(res);
};
export const deleteCreative = async (id: string): Promise<void> => {
  await apiClient.delete(`/ads/creatives/${id}`);
};

export const listLeads = async (params?: { campaignId?: string; status?: LeadStatus }) => {
  const res = await apiClient.get('/ads/leads', { params });
  return { items: unwrap<AdLead[]>(res), total: (res.data.total ?? 0) as number };
};

export const updateLeadStatus = async (id: string, status: LeadStatus, lostReason?: string) => {
  const res = await apiClient.patch(`/ads/leads/${id}/status`, { status, lostReason });
  return unwrap<AdLead>(res);
};

// Shop works its own leads (ownership verified server-side via the lead's campaign shop_id).
export const updateShopLeadStatus = async (id: string, status: LeadStatus, lostReason?: string) => {
  const res = await apiClient.patch(`/ads/shop/leads/${id}/status`, { status, lostReason });
  return unwrap<AdLead>(res);
};

// Lead follow-up is available to BOTH admin and the owning shop. Admin hits /ads/leads/:id/...,
// shop hits the ownership-gated /ads/shop/leads/:id/... — pick the base by the caller's mode.
export type LeadMode = 'admin' | 'shop';
const leadBase = (mode: LeadMode = 'admin') => (mode === 'shop' ? '/ads/shop/leads' : '/ads/leads');

// Follow-up activity timeline for a lead (calls/emails/notes/status changes).
export const getLeadActivities = async (id: string, mode: LeadMode = 'admin') => {
  const res = await apiClient.get(`${leadBase(mode)}/${id}/activities`);
  return unwrap<AdLeadActivity[]>(res);
};

// Send a tracked email to a lead via Resend. Logs an email activity + posts to the thread.
// Throws on failure; a 503 with code 'email_not_configured' means the UI should fall back to mailto:.
export const sendLeadEmail = async (id: string, subject: string, html: string, mode: LeadMode = 'admin') => {
  const res = await apiClient.post(`${leadBase(mode)}/${id}/email`, { subject, html });
  return unwrap<{ success: boolean; messageId?: string }>(res);
};

// Log a manual follow-up activity — a note, or a call with an outcome. A logged call stamps
// first_response_at server-side. (Emails and status changes are logged by their own endpoints.)
export type LeadCallOutcome = 'reached' | 'no_answer' | 'booked' | 'not_interested';
export const logLeadActivity = async (
  id: string,
  type: 'note' | 'call',
  opts?: { outcome?: LeadCallOutcome; body?: string },
  mode: LeadMode = 'admin'
) => {
  const res = await apiClient.post(`${leadBase(mode)}/${id}/activities`, { type, ...opts });
  return unwrap<AdLeadActivity>(res);
};

// Stage 3 (Option C) — AI-drafted first outreach for a lead (admin).
export const draftLeadReply = async (id: string): Promise<string> => {
  const res = await apiClient.post(`/ads/leads/${id}/draft-reply`);
  return unwrap<{ draft: string }>(res).draft;
};

// Stage 3.5 — full AI auto-answer conversation thread (admin).
export interface LeadMessage {
  id: string;
  leadId: string;
  direction: 'inbound' | 'outbound';
  author: 'lead' | 'ai' | 'admin';
  channel: 'sms' | 'whatsapp' | 'messenger' | 'email' | 'manual';
  body: string;
  aiCostCents: number;
  deliveryStatus: 'recorded' | 'queued' | 'sent' | 'delivered' | 'failed';
  createdAt: string;
}
export const getLeadThread = async (id: string): Promise<LeadMessage[]> => {
  const res = await apiClient.get(`/ads/leads/${id}/messages`);
  return unwrap<LeadMessage[]>(res);
};
export const sendLeadMessage = async (id: string, body: string): Promise<LeadMessage> => {
  const res = await apiClient.post(`/ads/leads/${id}/messages`, { body });
  return unwrap<LeadMessage>(res);
};
export const autoAnswerLead = async (id: string): Promise<LeadMessage> => {
  const res = await apiClient.post(`/ads/leads/${id}/auto-answer`);
  return unwrap<LeadMessage>(res);
};

/* --------------------------- Public (landing page) ----------------------- */

// Submit a lead from a public landing-page form (UTM-attributed). No auth.
export const submitWebformLead = async (payload: {
  campaignId?: string; name?: string; phone?: string; email?: string;
  utm?: Record<string, string>; clickId?: string;
}): Promise<{ deduped: boolean }> => {
  const res = await apiClient.post('/ads/leads/webform', { ...payload, consentToContact: true });
  return unwrap<{ deduped: boolean }>(res);
};

/* ----------------------- Ad-program enrollment (opt-in) ------------------ */
// Shop self-serve "Request ads": shop requests → admin approves/declines. v1 keeps
// campaign creation admin-only; this just signals interest + sets the plan on approve.

export type EnrollmentStatus = 'pending' | 'approved' | 'declined';
export type CampaignGoal = 'more_bookings' | 'leads' | 'awareness' | 'promote_service';

// Multi-channel foundation (Google Ads plan, Slice 2). A campaign runs on one platform.
export type AdChannel = 'meta' | 'google';

export interface AdChannelEligibility {
  meta: { eligible: boolean; connected: boolean; reason: 'ok' | 'not_connected' };
  google: { eligible: boolean; connected: boolean; reason: 'ok' | 'tier_locked' | 'not_connected' };
}

// Which ad channels this shop can use (tier + connection). Drives the brief channel picker.
export const getAdChannelEligibility = async () => {
  const res = await apiClient.get('/ads/shop/ad-channels');
  return unwrap<AdChannelEligibility>(res);
};

/** Optional campaign brief — what the shop wants advertised. */
export interface CampaignBrief {
  promoteServiceIds?: string[];
  monthlyBudgetCents?: number | null;
  offer?: string | null;
  targetRadiusMiles?: number | null;
  goal?: CampaignGoal | null;
  /** Which channel to run on. Persisting it to the campaign's `platform` is the next step
   *  (needs a request-table column); today it's captured for the picker. */
  channel?: AdChannel;
}

export interface AdEnrollment {
  shopId: string;
  requestedPlan: FlatTierName;   // legacy rows may hold a/b/c
  status: EnrollmentStatus;
  message: string | null;
  promoteServiceIds: string[];
  monthlyBudgetCents: number | null;
  offer: string | null;
  targetRadiusMiles: number | null;
  goal: CampaignGoal | null;
  declineReason: string | null;
  createdAt: string;
}

// Goals are OUTCOMES (what the shop wants), not what to advertise (the service picker covers that).
// v1 offers two lead-driving outcomes. 'awareness' + 'promote_service' are kept in the type for
// legacy rows but dropped from the picker — see ads-v1-gaps-and-next-steps.md.
export const CAMPAIGN_GOALS: { value: CampaignGoal; label: string }[] = [
  { value: 'more_bookings', label: 'More bookings' },
  { value: 'leads', label: 'More leads / inquiries' },
];

export interface ShopCapacity {
  tier: string;
  maxCampaigns: number;
  usedCampaigns: number;
  remaining: number;
}
/** Tier campaign capacity for the current shop (lifecycle §9.5). */
export const getShopCapacity = async (): Promise<ShopCapacity> => {
  const res = await apiClient.get('/ads/shop/capacity');
  return unwrap<ShopCapacity>(res);
};

// Shop
export const requestAdsEnrollment = async (
  requestedPlan: FlatTierName, message?: string, brief?: CampaignBrief
): Promise<AdEnrollment> => {
  const res = await apiClient.post('/ads/shop/enrollment', { requestedPlan, message, brief });
  return unwrap<AdEnrollment>(res);
};
export const getMyEnrollment = async (): Promise<AdEnrollment | null> => {
  const res = await apiClient.get('/ads/shop/enrollment');
  return unwrap<AdEnrollment | null>(res);
};

// Admin
export const listEnrollments = async (status?: EnrollmentStatus): Promise<AdEnrollment[]> => {
  const res = await apiClient.get('/ads/enrollments', { params: status ? { status } : undefined });
  return unwrap<AdEnrollment[]>(res);
};
export const decideEnrollment = async (
  shopId: string, decision: 'approved' | 'declined', declineReason?: string
): Promise<AdEnrollment> => {
  const res = await apiClient.post(`/ads/enrollments/${shopId}/decide`, { decision, declineReason });
  return unwrap<AdEnrollment>(res);
};

/* ----------------------- Durable shop↔admin thread (Phase 2) ----------------------- */
export type AdMessageAuthor = 'shop' | 'admin' | 'system';
export interface AdMessage {
  id: string;
  shopId: string;
  author: AdMessageAuthor;
  body: string;
  kind: 'message' | 'event';
  createdAt: string;
}
// Shop side (own thread)
export const getMyAdMessages = async (): Promise<AdMessage[]> => {
  const res = await apiClient.get('/ads/shop/messages');
  return unwrap<AdMessage[]>(res);
};
export const postMyAdMessage = async (body: string): Promise<AdMessage> => {
  const res = await apiClient.post('/ads/shop/messages', { body });
  return unwrap<AdMessage>(res);
};
// Admin side (any shop's thread)
export const listShopAdMessages = async (shopId: string): Promise<AdMessage[]> => {
  const res = await apiClient.get(`/ads/shops/${shopId}/messages`);
  return unwrap<AdMessage[]>(res);
};
export const postShopAdMessage = async (shopId: string, body: string): Promise<AdMessage> => {
  const res = await apiClient.post(`/ads/shops/${shopId}/messages`, { body });
  return unwrap<AdMessage>(res);
};
// Admin inbox — every shop with messages (#2), reachable in any lifecycle state.
export interface AdInboxEntry {
  shopId: string;
  shopName: string | null;
  total: number;
  lastBody: string;
  lastAuthor: AdMessageAuthor;
  lastAt: string;
  awaitingReply: boolean;
  adsAccountConnected: boolean;
}
export const getAdMessageInbox = async (): Promise<AdInboxEntry[]> => {
  const res = await apiClient.get('/ads/messages/inbox');
  return unwrap<AdInboxEntry[]>(res);
};

/* ----------------------- Recurring campaign requests (Phase 3) ----------------------- */
export type CampaignRequestStatus = 'pending' | 'approved' | 'building' | 'live' | 'declined' | 'cancelled';
export interface AdCampaignRequest {
  id: string;
  shopId: string;
  promoteServiceIds: string[];
  monthlyBudgetCents: number | null;
  offer: string | null;
  targetRadiusMiles: number | null;
  goal: CampaignGoal | null;
  message: string | null;
  status: CampaignRequestStatus;
  campaignId: string | null;
  declineReason: string | null;
  createdAt: string;
}
// Shop
export const submitCampaignRequest = async (brief: CampaignBrief, message?: string): Promise<AdCampaignRequest> => {
  const res = await apiClient.post('/ads/shop/campaign-requests', { brief, message });
  return unwrap<AdCampaignRequest>(res);
};
export const listMyCampaignRequests = async (): Promise<AdCampaignRequest[]> => {
  const res = await apiClient.get('/ads/shop/campaign-requests');
  return unwrap<AdCampaignRequest[]>(res);
};
// Admin
export const listCampaignRequests = async (status?: CampaignRequestStatus): Promise<AdCampaignRequest[]> => {
  const res = await apiClient.get('/ads/campaign-requests', { params: status ? { status } : undefined });
  return unwrap<AdCampaignRequest[]>(res);
};
export const buildCampaignFromRequest = async (id: string, input?: { name?: string; dailyBudgetCents?: number }) => {
  // 4 min: Build generates an AI image (gpt-image-1 ~20-80s) + several Meta Graph calls.
  const res = await apiClient.post(`/ads/campaign-requests/${id}/build`, input ?? {}, { timeout: 240000 });
  return unwrap(res);
};
export const declineCampaignRequest = async (id: string, declineReason?: string): Promise<AdCampaignRequest> => {
  const res = await apiClient.post(`/ads/campaign-requests/${id}/decline`, { declineReason });
  return unwrap<AdCampaignRequest>(res);
};
// Stage-4 push P5 — review/edit a PAUSED Meta draft, then take it live (Option B).
export interface CampaignDraftEdit {
  dailyBudgetCents?: number; radiusMiles?: number; headline?: string; primaryText?: string;
  regenerateImage?: boolean;
  /** Admin description for a prompt-driven image regenerate (implies regenerateImage). */
  imagePrompt?: string;
  /** A manually-uploaded designer image (public URL) to use instead of AI generation. */
  manualImageUrl?: string;
  /** Meta objective picker (pre-push only): OUTCOME_TRAFFIC | OUTCOME_AWARENESS. */
  objective?: string;
  /** Opt into Meta Advantage+ creative enhancements (applies on the next creative push). */
  allowMetaEnhancements?: boolean;
  /** Safeguard 4 — start at a reduced test budget (pre-push only). */
  isTestBudget?: boolean;
}
export const updateCampaignDraft = async (id: string, edits: CampaignDraftEdit): Promise<AdCampaign> => {
  // Regenerating the image runs gpt-image-1 → allow up to 4 min.
  const res = await apiClient.patch(`/ads/campaigns/${id}/draft`, edits, { timeout: 240000 });
  return unwrap<AdCampaign>(res);
};
/** Regenerate the campaign's AI ad image from an admin description (re-arms review → pending). */
export const regenerateAdImage = async (campaignId: string, imagePrompt: string): Promise<AdCampaign> =>
  updateCampaignDraft(campaignId, { regenerateImage: true, imagePrompt });

/** Upload a designer-made image for the campaign creative → returns its public URL. */
export const uploadAdCreativeImage = async (campaignId: string, file: File): Promise<string> => {
  const fd = new FormData();
  fd.append('image', file);
  const res = await apiClient.post(`/ads/campaigns/${campaignId}/creative-image`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
  });
  return unwrap<{ url: string }>(res).url;
};
/** Use a manually-uploaded image as the campaign creative (re-arms review → pending). */
export const useManualAdImage = async (campaignId: string, manualImageUrl: string): Promise<AdCampaign> =>
  updateCampaignDraft(campaignId, { manualImageUrl });
/** Prepare→push: kick off creation of the PAUSED Meta objects from a reviewed local draft.
 *  ASYNC — the backend returns 202 immediately and creates the Meta objects in the background
 *  (the multi-call Graph sequence was exceeding the gateway timeout → 504). Poll listCampaigns
 *  for the campaign flipping to `paused` to confirm success. */
export const pushCampaignToMeta = async (id: string): Promise<{ campaignId: string; status: string }> => {
  const res = await apiClient.post(`/ads/campaigns/${id}/push`, {});
  return unwrap<{ campaignId: string; status: string }>(res);
};
export const goLiveCampaign = async (id: string): Promise<{ campaignId: string; status: string }> => {
  const res = await apiClient.post(`/ads/campaigns/${id}/go-live`, {});
  return unwrap(res);
};
/** Safeguard 4 — scale a test-budget campaign up to its full daily budget. */
export const scaleCampaignBudget = async (id: string): Promise<AdCampaign> => {
  const res = await apiClient.post(`/ads/campaigns/${id}/scale-to-full`, {});
  return unwrap<AdCampaign>(res);
};

/** Two-way config sync — pull this campaign's budget/status back FROM Meta into our DB
 *  (Meta is source-of-truth for live). Returns the fresh campaign + which fields changed
 *  (empty when already in sync, the feature is off, or the campaign isn't pushed). */
export type SyncFromMetaStatus = 'disabled' | 'skipped' | 'synced' | 'in_sync' | 'diverged' | 'error';
export interface SyncFromMetaResult {
  campaign: AdCampaign;
  status: SyncFromMetaStatus;
  changes: Record<string, unknown>;
  reason?: 'not_pushed' | 'disconnected' | 'meta_archived' | 'meta_deleted';
  error?: string;
}
export const syncCampaignFromMeta = async (id: string): Promise<SyncFromMetaResult> => {
  const res = await apiClient.post(`/ads/campaigns/${id}/sync-from-meta`, {});
  return unwrap<SyncFromMetaResult>(res);
};

// Landing-page magnet overrides (Phase 2). All optional — anything unset auto-composes.
export interface LandingConfig {
  headline?: string;
  subhead?: string;
  urgencyText?: string;
  benefitBullets?: string[];
  ctaLabel?: string;
  showRating?: boolean;
  callNowEnabled?: boolean;
}
export const getLandingConfig = async (campaignId: string): Promise<LandingConfig> => {
  const res = await apiClient.get(`/ads/campaigns/${campaignId}/landing-config`);
  return unwrap<LandingConfig>(res);
};
export const updateLandingConfig = async (campaignId: string, config: LandingConfig): Promise<LandingConfig> => {
  const res = await apiClient.put(`/ads/campaigns/${campaignId}/landing-config`, config);
  return unwrap<LandingConfig>(res);
};

// The connected ad account's currency + minimum daily budget — so the budget field is shown in
// the account's own currency (no $/PHP ambiguity) and validated against the minimum.
export interface ShopMetaAccount {
  connected: boolean;
  currency?: string | null;
  minDailyBudgetCents?: number | null;
  accountActive?: boolean;
  hasFunding?: boolean;
  /** Two-way config-sync feature flag — gates the admin "Refresh from Meta" button. */
  configSyncEnabled?: boolean;
}
export const getShopMetaAccount = async (shopId: string): Promise<ShopMetaAccount> => {
  const res = await apiClient.get(`/ads/shops/${shopId}/meta-account`);
  return unwrap<ShopMetaAccount>(res);
};
// §9.6 — admin marks a shop's ad account connected/disconnected (build precondition).
export const setShopAdsAccount = async (shopId: string, connected: boolean) => {
  const res = await apiClient.post(`/ads/shops/${shopId}/ads-account`, { connected });
  return unwrap(res);
};

/* ----------------------- Self-serve subscription / tier (Phase 4) ----------------------- */
export interface PlanChange {
  id: string;
  fromTier: string | null;
  toTier: string | null;
  kind: 'upgrade' | 'downgrade' | 'cancel';
  status: 'applied' | 'scheduled' | 'cancelled';
  effectiveAt: string;
  proratedAmountCents: number;
  createdAt: string;
}
export interface AdSubscription {
  tier: FlatTierName | null;
  flatFeeCents: number;
  subscriptionStatus: 'active' | 'past_due' | 'paused' | 'cancelled';
  billingStartedAt: string | null;
  adsAccountConnected: boolean;
  history: PlanChange[];
}
export const getMySubscription = async (): Promise<AdSubscription> => {
  const res = await apiClient.get('/ads/shop/subscription');
  return unwrap<AdSubscription>(res);
};
export const changeMyTier = async (tier: FlatTierName): Promise<{ outcome: string; effectiveAt?: string; proratedAmountCents?: number }> => {
  const res = await apiClient.post('/ads/shop/subscription/change', { tier });
  return unwrap(res);
};
export const cancelMySubscription = async (): Promise<void> => {
  await apiClient.post('/ads/shop/subscription/cancel', {});
};

/* ----------------------- Connect Meta (Stage-4 connect slice) ----------------------- */
export interface MetaConnection {
  enabled: boolean;       // ADS_META_CONNECT_ENABLED + a configured Meta App
  connected: boolean;     // §9.6 gate (a Page is selected)
  hasToken: boolean;      // OAuth done but no account/Page picked yet
  adAccountId: string | null;
  pageId: string | null;
  currency?: string | null; // the connected ad account's currency (ISO code) — for the shop budget label
  leadgenTosAccepted?: boolean | null; // has the Page accepted Meta's Lead Gen ToS? (null = unknown)
}
export interface MetaAdAccount { id: string; accountId: string; name: string; status?: number; }
export interface MetaPageLite { id: string; name: string; }

export const getMetaConnection = async (): Promise<MetaConnection> => {
  const res = await apiClient.get('/ads/shop/meta/connection');
  return unwrap<MetaConnection>(res);
};
export const getMetaConnectUrl = async (): Promise<string> => {
  const res = await apiClient.get('/ads/shop/meta/connect');
  return unwrap<{ authUrl: string }>(res).authUrl;
};
export const getMetaAccounts = async (): Promise<{ adAccounts: MetaAdAccount[]; pages: MetaPageLite[] }> => {
  const res = await apiClient.get('/ads/shop/meta/accounts');
  return unwrap(res);
};
export const selectMetaAccount = async (adAccountId: string, pageId: string) => {
  const res = await apiClient.post('/ads/shop/meta/select', { adAccountId, pageId });
  return unwrap<{ adAccountId: string; pageId: string; connected: boolean }>(res);
};
export const disconnectMeta = async (): Promise<void> => {
  await apiClient.post('/ads/shop/meta/disconnect', {});
};

/* ----------------------- Connect Google (Google plan, Slice 1) ----------------------- */
export interface GoogleConnection {
  enabled: boolean;       // ADS_GOOGLE_CONNECT_ENABLED + a configured Google app
  connected: boolean;     // a customer account is selected
  hasToken: boolean;      // OAuth done but no customer picked yet
  customerId: string | null;
}
export interface GoogleCustomerLite { customerId: string; name: string; managerId?: string | null; }

export const getGoogleConnection = async (): Promise<GoogleConnection> => {
  const res = await apiClient.get('/ads/shop/google/connection');
  return unwrap<GoogleConnection>(res);
};
export const getGoogleConnectUrl = async (): Promise<string> => {
  const res = await apiClient.get('/ads/shop/google/connect');
  return unwrap<{ authUrl: string }>(res).authUrl;
};
export const getGoogleAccounts = async (): Promise<{ accounts: GoogleCustomerLite[] }> => {
  const res = await apiClient.get('/ads/shop/google/accounts');
  return unwrap(res);
};
export const selectGoogleAccount = async (customerId: string) => {
  const res = await apiClient.post('/ads/shop/google/select', { customerId });
  return unwrap<{ customerId: string; connected: boolean }>(res);
};
export const disconnectGoogle = async (): Promise<void> => {
  await apiClient.post('/ads/shop/google/disconnect', {});
};

/* --------------------------------- Shop ---------------------------------- */

export const listShopCampaigns = async (params?: { status?: CampaignStatus }) => {
  const res = await apiClient.get('/ads/shop/campaigns', { params });
  return { items: unwrap<AdCampaign[]>(res), total: (res.data.total ?? 0) as number };
};

export const getShopCampaignPerformance = async (id: string) => {
  const res = await apiClient.get(`/ads/shop/campaigns/${id}/performance`);
  return unwrap<CampaignPerformance>(res);
};

export const listShopLeads = async (params?: { campaignId?: string; status?: LeadStatus }) => {
  const res = await apiClient.get('/ads/shop/leads', { params });
  return { items: unwrap<AdLead[]>(res), total: (res.data.total ?? 0) as number };
};

// First-response SLA — leads with no response yet (oldest first).
export const listAwaitingLeads = async (): Promise<AdLead[]> => {
  const res = await apiClient.get('/ads/leads/awaiting');
  return unwrap<AdLead[]>(res);
};
export const listShopAwaitingLeads = async (): Promise<AdLead[]> => {
  const res = await apiClient.get('/ads/shop/leads/awaiting');
  return unwrap<AdLead[]>(res);
};

/* ------------------------------- Formatters ------------------------------ */

export const fmtUsd = (cents: number | null | undefined): string =>
  cents == null ? '—' : `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// SHOP ad money (budget / spend / revenue / CPL / CPB) shown in the connected ad account's
// own currency — avoids the "$ vs PHP" ambiguity. Falls back to USD when currency is unknown
// (legacy rows / not connected). Use fmtUsd for FixFlow's OWN fees/COGS, which are always USD.
export const fmtMoney = (cents: number | null | undefined, currency?: string | null): string => {
  if (cents == null) return '—';
  const ccy = (currency || 'USD').toUpperCase();
  try {
    return (cents / 100).toLocaleString(undefined, {
      style: 'currency', currency: ccy, minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
  } catch {
    // Unknown/invalid ISO code → plain number + code suffix.
    return `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${ccy}`;
  }
};

export const fmtRoi = (roi: number | null): string =>
  roi == null ? '—' : `${(roi * 100).toFixed(0)}%`;

// Precise dollar formatter for tiny AI costs (e.g. $0.0003) where fmtUsd's
// whole-dollar rounding would collapse to "$0".
export const fmtUsdPrecise = (cents: number | null | undefined): string =>
  cents == null ? '—' : (cents / 100).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4,
  });
