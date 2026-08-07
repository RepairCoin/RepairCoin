import apiClient from "@/shared/utilities/axios";
import { SEND_TIMEOUT_MS } from "../constants/marketingConstants";
import {
  GetCampaignsResponse,
  CampaignResponse,
  DeleteCampaignResponse,
  SendCampaignResponse,
  CampaignStatsResponse,
  AudienceCountResponse,
  MarketingTemplatesResponse,
  MarketingTemplateResponse,
  MarketingCustomersResponse,
  GetContactsResponse,
  ContactResponse,
  DeleteContactResponse,
  ContactStatsResponse,
  SendContactEmailCampaignResponse,
  SendTestEmailResponse,
  CreateCampaignData,
  UpdateCampaignData,
  CreateContactData,
  UpdateContactData,
  CampaignStatus,
  CampaignAudienceType,
  CampaignDeliveryMethod,
} from "./marketing.interface";

// NOTE: no `aiDraftCampaign` — no AI anywhere in mobile marketing.
class MarketingApi {
  // ─── Campaigns ──────────────────────────────────────────────────────────────

  async getCampaigns(
    shopId: string,
    page: number = 1,
    limit: number = 10,
    status?: CampaignStatus
  ): Promise<GetCampaignsResponse> {
    try {
      let url = `/marketing/shops/${shopId}/campaigns?page=${page}&limit=${limit}`;
      if (status) url += `&status=${status}`;
      return await apiClient.get<GetCampaignsResponse>(url);
    } catch (error) {
      console.error("Failed to get campaigns:", error);
      throw error;
    }
  }

  async getCampaign(campaignId: string): Promise<CampaignResponse> {
    try {
      return await apiClient.get<CampaignResponse>(`/marketing/campaigns/${campaignId}`);
    } catch (error) {
      console.error("Failed to get campaign:", error);
      throw error;
    }
  }

  async createCampaign(shopId: string, data: CreateCampaignData): Promise<CampaignResponse> {
    try {
      return await apiClient.post<CampaignResponse>(`/marketing/shops/${shopId}/campaigns`, data);
    } catch (error) {
      console.error("Failed to create campaign:", error);
      throw error;
    }
  }

  // Never pass `reward` here — omitted = no-op server-side; null/{type:'none'} would clear a
  // web-configured reward. See CreateCampaignData['reward'] and useCampaignMutations.
  async updateCampaign(campaignId: string, data: UpdateCampaignData): Promise<CampaignResponse> {
    try {
      return await apiClient.put<CampaignResponse>(`/marketing/campaigns/${campaignId}`, data);
    } catch (error) {
      console.error("Failed to update campaign:", error);
      throw error;
    }
  }

  async deleteCampaign(campaignId: string): Promise<DeleteCampaignResponse> {
    try {
      return await apiClient.delete<DeleteCampaignResponse>(`/marketing/campaigns/${campaignId}`);
    } catch (error) {
      console.error("Failed to delete campaign:", error);
      throw error;
    }
  }

  // Sending is synchronous and unqueued server-side (one email per recipient, awaited serially),
  // so this overrides the default timeout — see SEND_TIMEOUT_MS.
  async sendCampaign(campaignId: string): Promise<SendCampaignResponse> {
    try {
      return await apiClient.post<SendCampaignResponse>(
        `/marketing/campaigns/${campaignId}/send`,
        undefined,
        { timeout: SEND_TIMEOUT_MS }
      );
    } catch (error) {
      console.error("Failed to send campaign:", error);
      throw error;
    }
  }

  async scheduleCampaign(campaignId: string, scheduledAt: string): Promise<CampaignResponse> {
    try {
      return await apiClient.post<CampaignResponse>(`/marketing/campaigns/${campaignId}/schedule`, {
        scheduledAt,
      });
    } catch (error) {
      console.error("Failed to schedule campaign:", error);
      throw error;
    }
  }

  async cancelCampaign(campaignId: string): Promise<CampaignResponse> {
    try {
      return await apiClient.post<CampaignResponse>(`/marketing/campaigns/${campaignId}/cancel`);
    } catch (error) {
      console.error("Failed to cancel campaign:", error);
      throw error;
    }
  }

  async getCampaignStats(shopId: string): Promise<CampaignStatsResponse> {
    try {
      return await apiClient.get<CampaignStatsResponse>(`/marketing/shops/${shopId}/stats`);
    } catch (error) {
      console.error("Failed to get campaign stats:", error);
      throw error;
    }
  }

  async getAudienceCount(
    shopId: string,
    audienceType: CampaignAudienceType,
    audienceFilters?: Record<string, any>,
    deliveryMethod?: CampaignDeliveryMethod
  ): Promise<AudienceCountResponse> {
    try {
      const params = new URLSearchParams({ audienceType });
      if (audienceFilters) params.append("audienceFilters", JSON.stringify(audienceFilters));
      if (deliveryMethod) params.append("deliveryMethod", deliveryMethod);
      return await apiClient.get<AudienceCountResponse>(
        `/marketing/shops/${shopId}/audience-count?${params}`
      );
    } catch (error) {
      console.error("Failed to get audience count:", error);
      throw error;
    }
  }

  // "Select customers" audience picker — paginated shop customers, not the contacts list.
  async getMarketingCustomers(
    shopId: string,
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<MarketingCustomersResponse> {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) params.append("search", search);
      return await apiClient.get<MarketingCustomersResponse>(
        `/marketing/shops/${shopId}/customers?${params}`
      );
    } catch (error) {
      console.error("Failed to get marketing customers:", error);
      throw error;
    }
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  async getTemplates(category?: string): Promise<MarketingTemplatesResponse> {
    try {
      const url = category ? `/marketing/templates?category=${category}` : "/marketing/templates";
      return await apiClient.get<MarketingTemplatesResponse>(url);
    } catch (error) {
      console.error("Failed to get templates:", error);
      throw error;
    }
  }

  async getTemplate(templateId: string): Promise<MarketingTemplateResponse> {
    try {
      return await apiClient.get<MarketingTemplateResponse>(`/marketing/templates/${templateId}`);
    } catch (error) {
      console.error("Failed to get template:", error);
      throw error;
    }
  }

  // ─── Contacts ───────────────────────────────────────────────────────────────

  async getContacts(shopId: string, status?: string, search?: string): Promise<GetContactsResponse> {
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (search) params.append("search", search);
      const query = params.toString();
      return await apiClient.get<GetContactsResponse>(
        `/marketing/shops/${shopId}/contacts${query ? `?${query}` : ""}`
      );
    } catch (error) {
      console.error("Failed to get contacts:", error);
      throw error;
    }
  }

  async createContact(shopId: string, data: CreateContactData): Promise<ContactResponse> {
    try {
      return await apiClient.post<ContactResponse>(`/marketing/shops/${shopId}/contacts`, data);
    } catch (error) {
      console.error("Failed to create contact:", error);
      throw error;
    }
  }

  async updateContact(contactId: string, data: UpdateContactData): Promise<ContactResponse> {
    try {
      return await apiClient.put<ContactResponse>(`/marketing/contacts/${contactId}`, data);
    } catch (error) {
      console.error("Failed to update contact:", error);
      throw error;
    }
  }

  async deleteContact(contactId: string): Promise<DeleteContactResponse> {
    try {
      return await apiClient.delete<DeleteContactResponse>(`/marketing/contacts/${contactId}`);
    } catch (error) {
      console.error("Failed to delete contact:", error);
      throw error;
    }
  }

  async getContactStats(shopId: string): Promise<ContactStatsResponse> {
    try {
      return await apiClient.get<ContactStatsResponse>(`/marketing/shops/${shopId}/contacts/stats`);
    } catch (error) {
      console.error("Failed to get contact stats:", error);
      throw error;
    }
  }

  // Same unqueued-send caveat as sendCampaign — hence SEND_TIMEOUT_MS and the CONTACT_BLAST_MAX cap.
  async sendContactEmailCampaign(
    shopId: string,
    subject: string,
    htmlContent: string,
    contactIds?: string[]
  ): Promise<SendContactEmailCampaignResponse> {
    try {
      return await apiClient.post<SendContactEmailCampaignResponse>(
        `/marketing/shops/${shopId}/contacts/send-email`,
        { subject, htmlContent, contactIds },
        { timeout: SEND_TIMEOUT_MS }
      );
    } catch (error) {
      console.error("Failed to send contact email campaign:", error);
      throw error;
    }
  }

  async sendTestEmail(
    shopId: string,
    subject: string,
    htmlContent: string,
    testEmail: string
  ): Promise<SendTestEmailResponse> {
    try {
      return await apiClient.post<SendTestEmailResponse>(
        `/marketing/shops/${shopId}/contacts/test-email`,
        { subject, htmlContent, testEmail }
      );
    } catch (error) {
      console.error("Failed to send test email:", error);
      throw error;
    }
  }
}

export const marketingApi = new MarketingApi();
