// backend/src/domains/AdsDomain/services/GoogleAdsService.ts
//
// Google Ads integration — Slice 1 (connect). OAuth (authorize → exchange → refresh) + list the
// user's accessible customer accounts, via plain HTTPS (no google-ads-api dependency yet; that
// comes with the push/insights slices which need GAQL). Mirrors MetaService's surface.
// Gated by isConfigured() — GOOGLE_ADS_CLIENT_ID/SECRET + GOOGLE_ADS_DEVELOPER_TOKEN.
// See docs/tasks/strategy/ads-google-ads-implementation-plan.md (Slice 1 / BE-1).

import axios from 'axios';
import { logger } from '../../../utils/logger';

const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';
// Google sunsets API versions ~yearly — verified live: v20 and below are deprecated/404, v21-v24
// work, v24 is the newest. Keep it env-overridable; bump when Google ships a newer version.
const API_VERSION = (process.env.GOOGLE_ADS_API_VERSION || 'v24').trim();
const ADS_API = `https://googleads.googleapis.com/${API_VERSION}`;

export interface GoogleTokenResult { accessToken: string; refreshToken: string | null; expiresIn: number; }
export interface GoogleCustomer { customerId: string; name: string; }

export class GoogleAdsService {
  /** True when the FixFlow Google Ads app + developer token are configured. */
  isConfigured(): boolean {
    return !!(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
  }

  private clientId(): string { return (process.env.GOOGLE_ADS_CLIENT_ID || '').trim(); }
  private clientSecret(): string { return (process.env.GOOGLE_ADS_CLIENT_SECRET || '').trim(); }
  private developerToken(): string { return (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim(); }
  /** Optional MCC/login-customer-id (digits only) for the Ads API header. */
  private loginCustomerId(): string { return (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, ''); }

  /** OAuth consent URL. offline + prompt=consent so we always receive a refresh token. */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: ADWORDS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${OAUTH_AUTH}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<GoogleTokenResult> {
    try {
      const res = await axios.post(
        OAUTH_TOKEN,
        new URLSearchParams({
          code,
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
      );
      return {
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token ?? null,
        expiresIn: res.data.expires_in ?? 3600,
      };
    } catch (err: any) {
      logger.error('GoogleAdsService.exchangeCodeForToken failed', err?.response?.data || err?.message);
      throw new Error(err?.response?.data?.error_description || err?.response?.data?.error || 'token_exchange_failed');
    }
  }

  /** Exchange a stored refresh token for a fresh access token (Google access tokens are short-lived). */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const res = await axios.post(
        OAUTH_TOKEN,
        new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          grant_type: 'refresh_token',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
      );
      return res.data.access_token;
    } catch (err: any) {
      logger.error('GoogleAdsService.refreshAccessToken failed', err?.response?.data || err?.message);
      throw new Error('google_token_refresh_failed');
    }
  }

  /** The customer accounts the authorized user can access (customers/<id> resource names).
   *  Descriptive-name resolution (via GAQL) is a follow-up — the picker shows the id for now. */
  async listAccessibleCustomers(accessToken: string): Promise<GoogleCustomer[]> {
    try {
      const res = await axios.get(`${ADS_API}/customers:listAccessibleCustomers`, {
        headers: this.apiHeaders(accessToken),
        timeout: 20000,
      });
      const names: string[] = res.data?.resourceNames || [];
      return names.map((rn) => {
        const id = rn.split('/')[1] || rn;
        return { customerId: id, name: id };
      });
    } catch (err: any) {
      logger.error('GoogleAdsService.listAccessibleCustomers failed', err?.response?.data || err?.message);
      throw new Error('google_list_customers_failed');
    }
  }

  /** Low-level mutate against a Google Ads resource collection. Returns the results (resource names).
   *  With `partialFailure`, per-operation failures (e.g. a policy-flagged keyword) come back as a 200
   *  with only the valid ops applied — the request itself doesn't throw. */
  private async mutate(customerId: string, accessToken: string, resource: string, operations: any[], partialFailure = false): Promise<any[]> {
    try {
      const body: any = { operations };
      if (partialFailure) body.partialFailure = true;
      const res = await axios.post(
        `${ADS_API}/customers/${customerId}/${resource}:mutate`,
        body,
        { headers: { ...this.apiHeaders(accessToken), 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      return res.data?.results || [];
    } catch (err: any) {
      const gerr = err?.response?.data?.error?.details?.[0]?.errors?.[0];
      const msg = gerr?.message || err?.response?.data?.error?.message || err?.message;
      logger.error(`GoogleAdsService.mutate ${resource} failed`, gerr || err?.response?.data || err?.message);
      throw new Error(`google_${resource}_failed: ${msg}`);
    }
  }

  /** Create a PAUSED Search campaign skeleton (budget → campaign → ad group) on the customer. Nothing
   *  serves until it's set ENABLED + funded (Slice 3 go-live). Returns the created ids. Slice 3 (BE-3a). */
  async createSearchCampaign(
    customerId: string,
    refreshToken: string,
    input: { name: string; dailyBudgetMicros: number }
  ): Promise<{ campaignId: string; campaignResourceName: string; budgetResourceName: string; adGroupId: string; adGroupResourceName: string }> {
    const access = await this.refreshAccessToken(refreshToken);
    const stamp = Date.now();
    // 1. Shared budget (daily, micros).
    const budget = await this.mutate(customerId, access, 'campaignBudgets', [
      { create: { name: `${input.name} Budget ${stamp}`, amountMicros: String(input.dailyBudgetMicros), deliveryMethod: 'STANDARD' } },
    ]);
    const budgetResourceName = budget[0].resourceName as string;
    // 2. Campaign — PAUSED, Search, manual CPC (no conversion setup needed to create a paused object).
    const camp = await this.mutate(customerId, access, 'campaigns', [
      { create: {
        name: `${input.name} ${stamp}`,
        status: 'PAUSED',
        advertisingChannelType: 'SEARCH',
        campaignBudget: budgetResourceName,
        manualCpc: {},
        networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
        // Required by Google Ads API v24+ (EU political ads declaration). FixFlow ads are not political.
        containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      } },
    ]);
    const campaignResourceName = camp[0].resourceName as string;
    const campaignId = campaignResourceName.split('/').pop() as string;
    // 3. Ad group — PAUSED.
    const ag = await this.mutate(customerId, access, 'adGroups', [
      { create: { name: `${input.name} Ad Group`, campaign: campaignResourceName, status: 'PAUSED', type: 'SEARCH_STANDARD' } },
    ]);
    const adGroupResourceName = ag[0].resourceName as string;
    const adGroupId = adGroupResourceName.split('/').pop() as string;
    return { campaignId, campaignResourceName, budgetResourceName, adGroupId, adGroupResourceName };
  }

  /** Add a Responsive Search Ad (PAUSED) + broad-match keywords to an ad group. RSA needs 3-15
   *  headlines (≤30 chars) + 2-4 descriptions (≤90). Slice 3 (BE-3b). */
  async addResponsiveSearchAdAndKeywords(
    customerId: string,
    refreshToken: string,
    adGroupResourceName: string,
    input: { headlines: string[]; descriptions: string[]; finalUrl: string; keywords: string[] }
  ): Promise<{ adResourceName: string; keywordCount: number }> {
    const access = await this.refreshAccessToken(refreshToken);
    const ad = await this.mutate(customerId, access, 'adGroupAds', [
      { create: {
        adGroup: adGroupResourceName,
        status: 'PAUSED',
        ad: {
          finalUrls: [input.finalUrl],
          responsiveSearchAd: {
            headlines: input.headlines.slice(0, 15).map((t) => ({ text: t })),
            descriptions: input.descriptions.slice(0, 4).map((t) => ({ text: t })),
          },
        },
      } },
    ]);
    const adResourceName = ad[0].resourceName as string;
    let keywordCount = 0;
    const kws = (input.keywords || []).map((k) => k.trim()).filter(Boolean).slice(0, 20);
    if (kws.length) {
      // partial-failure: keywords that trip a content policy (e.g. "Third Party Consumer Technical
      // Support") are skipped; the valid ones still get added. Count only the applied results.
      const ops = kws.map((k) => ({ create: { adGroup: adGroupResourceName, status: 'ENABLED', keyword: { text: k, matchType: 'BROAD' } } }));
      const res = await this.mutate(customerId, access, 'adGroupCriteria', ops, true);
      keywordCount = res.filter((r: any) => r?.resourceName).length;
    }
    return { adResourceName, keywordCount };
  }

  private apiHeaders(accessToken: string): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': this.developerToken(),
    };
    const login = this.loginCustomerId();
    if (login) h['login-customer-id'] = login;
    return h;
  }
}

export const googleAdsService = new GoogleAdsService();
