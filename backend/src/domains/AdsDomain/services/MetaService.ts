// backend/src/domains/AdsDomain/services/MetaService.ts
//
// Ads System Stage 4 — Meta Graph API surface (OAuth + Insights). SCAFFOLD:
// these need a registered FixFlow Meta App (META_APP_ID/META_APP_SECRET) and live
// Graph-API calls, which can't run/test without credentials. `isConfigured` and
// `getAuthorizationUrl` are real; token exchange / refresh / insights sync /
// lead-field fetch are stubs that throw until implemented against a real app.
// The Meta WEBHOOK (MetaWebhookService) IS built + tested — only this Graph side
// is pending credentials. See docs/tasks/strategy/ads-system/ (Stage 4).

import { logger } from '../../../utils/logger';

const GRAPH = 'https://graph.facebook.com/v19.0';

export class MetaService {
  /** True when the app credentials are present (gates the OAuth/Insights flows). */
  isConfigured(): boolean {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  /** Build the Meta OAuth dialog URL a shop is redirected to. Real (no API call). */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'leads_retrieval,ads_read,pages_show_list,pages_manage_ads',
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  // --- The following require a registered Meta App + live Graph API. STUBS. ---

  /** Exchange an OAuth code for a long-lived token (Graph). */
  async exchangeCodeForToken(_code: string, _redirectUri: string): Promise<never> {
    logger.warn(`MetaService.exchangeCodeForToken not implemented — needs Meta App (GET ${GRAPH}/oauth/access_token)`);
    throw new Error('Meta OAuth token exchange not implemented — requires a registered Meta App');
  }

  /** Refresh / extend a shop's token before meta_oauth_expires_at. */
  async refreshToken(_shopId: string): Promise<never> {
    throw new Error('Meta token refresh not implemented — requires a registered Meta App');
  }

  /** Fetch a lead's full fields (name/phone/email) by leadgen_id + page token. */
  async fetchLeadFields(_leadgenId: string, _pageToken: string): Promise<never> {
    throw new Error('Meta lead fetch not implemented — requires a registered Meta App');
  }

  /** Pull yesterday's campaign insights (spend/impressions/clicks) → ad_performance_daily. */
  async syncInsights(): Promise<never> {
    throw new Error('Meta insights sync not implemented — requires a registered Meta App');
  }
}

export const metaService = new MetaService();
