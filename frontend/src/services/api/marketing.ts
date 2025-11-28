import apiClient from './client';

export interface MarketingCampaign {
  id: string;
  shopId: string;
  name: string;
  campaignType: 'announce_service' | 'offer_coupon' | 'newsletter' | 'custom';
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  subject: string | null;
  previewText: string | null;
  designContent: Record<string, any>;
  templateId: string | null;
  audienceType: 'all_customers' | 'select_customers' | 'top_spenders' | 'frequent_visitors' | 'active_customers' | 'custom';
  audienceFilters: Record<string, any>;
  deliveryMethod: 'email' | 'in_app' | 'both';
  scheduledAt: string | null;
  sentAt: string | null;
  promoCodeId: number | null;
  couponValue: number | null;
  couponType: 'fixed' | 'percentage' | null;
  couponExpiresAt: string | null;
  serviceId: string | null;
  totalRecipients: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  inAppSent: number;
  inAppRead: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingTemplate {
  id: string;
  name: string;
  description: string | null;
  category: 'coupon' | 'announcement' | 'newsletter' | 'event';
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
  campaignType: MarketingCampaign['campaignType'];
  subject?: string;
  previewText?: string;
  designContent?: Record<string, any>;
  templateId?: string;
  audienceType?: MarketingCampaign['audienceType'];
  audienceFilters?: Record<string, any>;
  deliveryMethod?: MarketingCampaign['deliveryMethod'];
  promoCodeId?: number;
  couponValue?: number;
  couponType?: 'fixed' | 'percentage';
  couponExpiresAt?: string;
  serviceId?: string;
}

export interface CampaignDeliveryResult {
  totalRecipients: number;
  emailsSent: number;
  emailsFailed: number;
  inAppSent: number;
  inAppFailed: number;
}

export interface ShopCustomer {
  walletAddress: string;
  email?: string;
  name?: string;
  tier?: string;
  totalSpent?: number;
  visitCount?: number;
  lastVisit?: string;
}

export interface ShopCustomersResponse {
  customers: ShopCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Get all campaigns for a shop
export async function getCampaigns(
  shopId: string,
  page = 1,
  limit = 10,
  status?: MarketingCampaign['status']
): Promise<{
  items: MarketingCampaign[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (status) params.append('status', status);

  const response = await apiClient.get(`/marketing/shops/${shopId}/campaigns?${params}`);
  return response.data;
}

// Get a single campaign
export async function getCampaign(campaignId: string): Promise<MarketingCampaign> {
  const response = await apiClient.get(`/marketing/campaigns/${campaignId}`);
  return response.data;
}

// Create a new campaign
export async function createCampaign(
  shopId: string,
  data: CreateCampaignData
): Promise<MarketingCampaign> {
  const response = await apiClient.post(`/marketing/shops/${shopId}/campaigns`, data);
  return response.data;
}

// Update a campaign
export async function updateCampaign(
  campaignId: string,
  data: Partial<CreateCampaignData>
): Promise<MarketingCampaign> {
  const response = await apiClient.put(`/marketing/campaigns/${campaignId}`, data);
  return response.data;
}

// Delete a campaign
export async function deleteCampaign(campaignId: string): Promise<void> {
  await apiClient.delete(`/marketing/campaigns/${campaignId}`);
}

// Send a campaign immediately
export async function sendCampaign(campaignId: string): Promise<CampaignDeliveryResult> {
  const response = await apiClient.post(`/marketing/campaigns/${campaignId}/send`);
  return response.data;
}

// Schedule a campaign
export async function scheduleCampaign(
  campaignId: string,
  scheduledAt: string
): Promise<MarketingCampaign> {
  const response = await apiClient.post(`/marketing/campaigns/${campaignId}/schedule`, {
    scheduledAt,
  });
  return response.data;
}

// Cancel a scheduled campaign
export async function cancelCampaign(campaignId: string): Promise<MarketingCampaign> {
  const response = await apiClient.post(`/marketing/campaigns/${campaignId}/cancel`);
  return response.data;
}

// Get campaign statistics
export async function getCampaignStats(shopId: string): Promise<CampaignStats> {
  const response = await apiClient.get(`/marketing/shops/${shopId}/stats`);
  return response.data;
}

// Get audience count for targeting
export async function getAudienceCount(
  shopId: string,
  audienceType: MarketingCampaign['audienceType'],
  audienceFilters?: Record<string, any>
): Promise<number> {
  const params = new URLSearchParams({ audienceType });
  if (audienceFilters) {
    params.append('audienceFilters', JSON.stringify(audienceFilters));
  }
  const response = await apiClient.get(`/marketing/shops/${shopId}/audience-count?${params}`);
  return response.data.count;
}

// Get available templates
export async function getTemplates(category?: string): Promise<MarketingTemplate[]> {
  const params = category ? `?category=${category}` : '';
  const response = await apiClient.get(`/marketing/templates${params}`);
  return response.data;
}

// Get a specific template
export async function getTemplate(templateId: string): Promise<MarketingTemplate> {
  const response = await apiClient.get(`/marketing/templates/${templateId}`);
  return response.data;
}

// Get shop customers for campaign targeting
export async function getShopCustomers(
  shopId: string,
  page = 1,
  limit = 10,
  search?: string
): Promise<ShopCustomersResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.append('search', search);

  const response = await apiClient.get(`/marketing/shops/${shopId}/customers?${params}`);
  return response.data;
}
