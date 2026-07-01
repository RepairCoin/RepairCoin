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
// Google deprecates API versions ~yearly — keep it env-overridable.
const API_VERSION = (process.env.GOOGLE_ADS_API_VERSION || 'v18').trim();
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
