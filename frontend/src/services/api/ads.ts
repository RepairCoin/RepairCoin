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

/* --------------------------- Public (landing page) ----------------------- */

// Submit a lead from a public landing-page form (UTM-attributed). No auth.
export const submitWebformLead = async (payload: {
  campaignId?: string; name?: string; phone?: string; email?: string;
  utm?: Record<string, string>; clickId?: string;
}): Promise<{ deduped: boolean }> => {
  const res = await apiClient.post('/ads/leads/webform', { ...payload, consentToContact: true });
  return unwrap<{ deduped: boolean }>(res);
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
