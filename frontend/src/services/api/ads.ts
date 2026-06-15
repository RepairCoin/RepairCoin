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
  aiAgentEnabled: boolean;
  notes: string | null;
  createdAt: string;
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
  version: number;
  reviewStatus: CreativeReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
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
export interface AdEnrollment {
  shopId: string;
  requestedPlan: FlatTierName;   // legacy rows may hold a/b/c
  status: EnrollmentStatus;
  message: string | null;
  declineReason: string | null;
  createdAt: string;
}

// Shop
export const requestAdsEnrollment = async (requestedPlan: FlatTierName, message?: string): Promise<AdEnrollment> => {
  const res = await apiClient.post('/ads/shop/enrollment', { requestedPlan, message });
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

export const fmtRoi = (roi: number | null): string =>
  roi == null ? '—' : `${(roi * 100).toFixed(0)}%`;

// Precise dollar formatter for tiny AI costs (e.g. $0.0003) where fmtUsd's
// whole-dollar rounding would collapse to "$0".
export const fmtUsdPrecise = (cents: number | null | undefined): string =>
  cents == null ? '—' : (cents / 100).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4,
  });
