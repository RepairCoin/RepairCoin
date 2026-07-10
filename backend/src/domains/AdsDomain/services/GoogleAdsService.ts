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
// Name of the FixFlow "Lead" conversion action created per account for offline conversion imports.
const CONVERSION_ACTION_NAME = 'FixFlow Lead';

/** PURE: the campaign bidding strategy field. Conversion-optimized (Maximize Conversions, bids
 *  toward the FixFlow Lead conversion action) when opted in via ADS_GOOGLE_OPTIMIZE_FOR_LEAD;
 *  otherwise manual CPC (drive clicks). Only meaningful once conversions have accrued — hence
 *  opt-in per account. Analog of Meta's pixel-Lead optimization. */
export function campaignBiddingSpec(optimizeForConversions: boolean): Record<string, unknown> {
  return optimizeForConversions ? { maximizeConversions: {} } : { manualCpc: {} };
}

/** PURE: a Google campaign PROXIMITY criterion (radius around a point) from lat/lng + miles.
 *  Google wants lat/lng in micro-degrees (×1e6, integer). Local-service ads should target nearby
 *  searchers, not nationwide. Unit-testable. */
export function proximityCriterion(customerId: string, campaignId: string, lat: number, lng: number, radiusMiles: number): Record<string, unknown> {
  return {
    campaign: `customers/${customerId}/campaigns/${String(campaignId).replace(/\D/g, '')}`,
    proximity: {
      geoPoint: {
        latitudeInMicroDegrees: Math.round(lat * 1_000_000),
        longitudeInMicroDegrees: Math.round(lng * 1_000_000),
      },
      radius: radiusMiles,
      radiusUnits: 'MILES',
    },
  };
}

/** PURE: shape GAQL ad_group_ad + ad_group_criterion rows into local ad content. Reads the first
 *  non-removed RSA. Tolerant of missing fields. Used by the composer populate + config-sync reflect. */
export function mapAdContentRows(adRows: any[], kwRows: any[]): { headlines: string[]; descriptions: string[]; keywords: string[]; finalUrl: string | null; adId: string | null } {
  const ad = (adRows || [])[0]?.adGroupAd;
  const rsa = ad?.ad?.responsiveSearchAd || {};
  const headlines = (rsa.headlines || []).map((h: any) => String(h?.text || '').trim()).filter(Boolean);
  const descriptions = (rsa.descriptions || []).map((d: any) => String(d?.text || '').trim()).filter(Boolean);
  const finalUrl = ad?.ad?.finalUrls?.[0] ?? null;
  const adId = ad?.resourceName ? String(ad.resourceName).split('/').pop() ?? null : null;
  const keywords = Array.from(new Set((kwRows || []).map((r: any) => String(r?.adGroupCriterion?.keyword?.text || '').trim()).filter(Boolean)));
  return { headlines, descriptions, keywords, finalUrl, adId };
}

/** PURE: validate + normalize RSA copy to Google's rules (≥3 headlines ≤30, ≥2 descriptions ≤90).
 *  Trims, drops empties/over-length, dedupes, caps at 15/4. Returns {error} when the minimums aren't
 *  met so the composer can reject before pushing (Google rejects an invalid RSA). */
export function validateRsaContent(
  headlines: string[], descriptions: string[]
): { headlines: string[]; descriptions: string[] } | { error: string } {
  const norm = (arr: string[], max: number) =>
    Array.from(new Set((arr || []).map((s) => String(s || '').trim()).filter((s) => s && s.length <= max)));
  const h = norm(headlines, 30);
  const d = norm(descriptions, 90);
  if (h.length < 3) return { error: 'need at least 3 headlines, each ≤30 characters' };
  if (d.length < 2) return { error: 'need at least 2 descriptions, each ≤90 characters' };
  return { headlines: h.slice(0, 15), descriptions: d.slice(0, 4) };
}

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
  private async mutate(customerId: string, accessToken: string, resource: string, operations: any[], partialFailure = false, loginCustomerId?: string): Promise<any[]> {
    try {
      const body: any = { operations };
      if (partialFailure) body.partialFailure = true;
      const res = await axios.post(
        `${ADS_API}/customers/${customerId}/${resource}:mutate`,
        body,
        { headers: { ...this.apiHeaders(accessToken, loginCustomerId), 'Content-Type': 'application/json' }, timeout: 30000 }
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
    input: { name: string; dailyBudgetMicros: number; optimizeForConversions?: boolean },
    loginCustomerId?: string
  ): Promise<{ campaignId: string; campaignResourceName: string; budgetResourceName: string; adGroupId: string; adGroupResourceName: string }> {
    const access = await this.refreshAccessToken(refreshToken);
    const stamp = Date.now();
    // 1. Shared budget (daily, micros).
    const budget = await this.mutate(customerId, access, 'campaignBudgets', [
      { create: { name: `${input.name} Budget ${stamp}`, amountMicros: String(input.dailyBudgetMicros), deliveryMethod: 'STANDARD' } },
    ], false, loginCustomerId);
    const budgetResourceName = budget[0].resourceName as string;
    // 2. Campaign — PAUSED, Search. Bidding = manual CPC (clicks) or Maximize Conversions when
    // ADS_GOOGLE_OPTIMIZE_FOR_LEAD is opted in (requires the Lead conversion action to exist).
    const camp = await this.mutate(customerId, access, 'campaigns', [
      { create: {
        name: `${input.name} ${stamp}`,
        status: 'PAUSED',
        advertisingChannelType: 'SEARCH',
        campaignBudget: budgetResourceName,
        ...campaignBiddingSpec(input.optimizeForConversions === true),
        networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
        // Required by Google Ads API v24+ (EU political ads declaration). FixFlow ads are not political.
        containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      } },
    ], false, loginCustomerId);
    const campaignResourceName = camp[0].resourceName as string;
    const campaignId = campaignResourceName.split('/').pop() as string;
    // 3. Ad group — PAUSED.
    const ag = await this.mutate(customerId, access, 'adGroups', [
      { create: { name: `${input.name} Ad Group`, campaign: campaignResourceName, status: 'PAUSED', type: 'SEARCH_STANDARD' } },
    ], false, loginCustomerId);
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
    input: { headlines: string[]; descriptions: string[]; finalUrl: string; keywords: string[] },
    loginCustomerId?: string
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
    ], false, loginCustomerId);
    const adResourceName = ad[0].resourceName as string;
    let keywordCount = 0;
    const kws = (input.keywords || []).map((k) => k.trim()).filter(Boolean).slice(0, 20);
    if (kws.length) {
      // partial-failure: keywords that trip a content policy (e.g. "Third Party Consumer Technical
      // Support") are skipped; the valid ones still get added. Count only the applied results.
      const ops = kws.map((k) => ({ create: { adGroup: adGroupResourceName, status: 'ENABLED', keyword: { text: k, matchType: 'BROAD' } } }));
      const res = await this.mutate(customerId, access, 'adGroupCriteria', ops, true, loginCustomerId);
      keywordCount = res.filter((r: any) => r?.resourceName).length;
    }
    return { adResourceName, keywordCount };
  }

  /** Flip a campaign's serving state: set the campaign, its ad group, and its ad(s) to ENABLED
   *  (go-live) or PAUSED. The RSA + all three objects are created PAUSED, so all must be enabled to
   *  serve; keywords are already ENABLED. The ad-group-ad update is partial-failure so one
   *  disapproved ad doesn't block the rest. Go-live / status-mirror. */
  async setCampaignServingStatus(
    customerId: string,
    refreshToken: string,
    input: { campaignId: string; adGroupId: string },
    status: 'ENABLED' | 'PAUSED',
    loginCustomerId?: string
  ): Promise<{ ads: number }> {
    const access = await this.refreshAccessToken(refreshToken);
    // 1. Campaign.
    await this.mutate(customerId, access, 'campaigns', [
      { update: { resourceName: `customers/${customerId}/campaigns/${input.campaignId}`, status }, updateMask: 'status' },
    ], false, loginCustomerId);
    // 2. Ad group.
    await this.mutate(customerId, access, 'adGroups', [
      { update: { resourceName: `customers/${customerId}/adGroups/${input.adGroupId}`, status }, updateMask: 'status' },
    ], false, loginCustomerId);
    // 3. Ad(s) in the group — the RSA was created PAUSED, so it must be enabled to serve.
    const rows = await this.search(customerId, access, loginCustomerId,
      `SELECT ad_group_ad.resource_name FROM ad_group_ad WHERE ad_group.id = ${input.adGroupId}`);
    const ops = rows.map((r: any) => ({ update: { resourceName: r.adGroupAd.resourceName, status }, updateMask: 'status' }));
    let ads = 0;
    if (ops.length) {
      const res = await this.mutate(customerId, access, 'adGroupAds', ops, true, loginCustomerId);
      ads = res.filter((r: any) => r?.resourceName).length;
    }
    return { ads };
  }

  /** Go-live preconditions on the shop's Google account: at least one ENABLED conversion action
   *  (so the campaign can measure/optimize) and an APPROVED billing setup (a payment profile → real
   *  spend). Both are unattainable on a TEST account, so go-live is effectively prod-only. Each
   *  query is best-effort — a missing/blocked resource reads as "not satisfied", not an error. */
  async getGoLivePreconditions(
    customerId: string,
    refreshToken: string,
    loginCustomerId?: string
  ): Promise<{ hasConversionAction: boolean; hasFunding: boolean }> {
    const access = await this.refreshAccessToken(refreshToken);
    let hasConversionAction = false;
    let hasFunding = false;
    try {
      const ca = await this.search(customerId, access, loginCustomerId,
        "SELECT conversion_action.id FROM conversion_action WHERE conversion_action.status = 'ENABLED' LIMIT 1");
      hasConversionAction = ca.length > 0;
    } catch (e: any) {
      logger.warn(`GoogleAdsService.getGoLivePreconditions conversion_action query failed: ${e?.message || e}`);
    }
    try {
      const bs = await this.search(customerId, access, loginCustomerId,
        "SELECT billing_setup.id FROM billing_setup WHERE billing_setup.status = 'APPROVED' LIMIT 1");
      hasFunding = bs.length > 0;
    } catch (e: any) {
      logger.warn(`GoogleAdsService.getGoLivePreconditions billing_setup query failed: ${e?.message || e}`);
    }
    return { hasConversionAction, hasFunding };
  }

  /** Daily campaign insights (spend/impressions/clicks) for the last N days, segmented by date.
   *  cost is returned in micros of the account currency. Slice 4 (nightly import). */
  async fetchCampaignInsights(
    customerId: string,
    refreshToken: string,
    campaignId: string,
    sinceDays: number,
    loginCustomerId?: string
  ): Promise<any[]> {
    const access = await this.refreshAccessToken(refreshToken);
    // GAQL DURING takes a named range; snap N to the supported windows (7/14/30).
    const range = sinceDays <= 7 ? 'LAST_7_DAYS' : sinceDays <= 14 ? 'LAST_14_DAYS' : 'LAST_30_DAYS';
    const query =
      `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks ` +
      `FROM campaign WHERE campaign.id = ${String(campaignId).replace(/\D/g, '')} AND segments.date DURING ${range}`;
    return this.search(customerId, access, loginCustomerId, query);
  }

  /** Current campaign config on Google (status + daily budget) for two-way config sync (Slice 5).
   *  cost/budget is returned in micros → cents (÷10,000). Returns nulls when the campaign isn't
   *  found (empty result). A REMOVED campaign is still returned here with status 'REMOVED'. */
  async fetchCampaignConfig(
    customerId: string,
    refreshToken: string,
    campaignId: string,
    loginCustomerId?: string
  ): Promise<{ campaignStatus: string | null; dailyBudgetCents: number | null }> {
    const access = await this.refreshAccessToken(refreshToken);
    const query =
      `SELECT campaign.status, campaign_budget.amount_micros ` +
      `FROM campaign WHERE campaign.id = ${String(campaignId).replace(/\D/g, '')}`;
    const rows = await this.search(customerId, access, loginCustomerId, query);
    const r = rows[0];
    if (!r) return { campaignStatus: null, dailyBudgetCents: null };
    const micros = r.campaignBudget?.amountMicros;
    const dailyBudgetCents = micros != null ? Math.round((parseInt(String(micros), 10) || 0) / 10000) : null;
    return { campaignStatus: r.campaign?.status ?? null, dailyBudgetCents };
  }

  /** Resolve (or create) the FixFlow "Lead" conversion action on the account and return its resource
   *  name. type=UPLOAD_CLICKS so we can import offline conversions by gclid; primaryForGoal so it
   *  counts toward the account's conversion goal (needed for conversion bidding in Phase 3).
   *  Idempotent by name. Slice: Google conversion-optimization (Phase 2). */
  async ensureLeadConversionAction(customerId: string, refreshToken: string, loginCustomerId?: string): Promise<string> {
    const access = await this.refreshAccessToken(refreshToken);
    const existing = await this.search(customerId, access, loginCustomerId,
      `SELECT conversion_action.resource_name FROM conversion_action ` +
      `WHERE conversion_action.name = '${CONVERSION_ACTION_NAME}' AND conversion_action.status != 'REMOVED' LIMIT 1`);
    if (existing[0]?.conversionAction?.resourceName) return existing[0].conversionAction.resourceName as string;
    const created = await this.mutate(customerId, access, 'conversionActions', [
      { create: {
        name: CONVERSION_ACTION_NAME,
        type: 'UPLOAD_CLICKS',
        category: 'SUBMIT_LEAD_FORM',
        status: 'ENABLED',
        primaryForGoal: true,
        countingType: 'ONE_PER_CLICK',
      } },
    ], false, loginCustomerId);
    return created[0].resourceName as string;
  }

  /** Import an offline click conversion (a lead that became a paid booking) against a conversion
   *  action, keyed by the gclid captured on the landing page. partialFailure so a stale/out-of-window
   *  gclid is reported (and logged) rather than throwing. Slice: Phase 2. */
  async uploadClickConversion(
    customerId: string,
    refreshToken: string,
    input: { gclid: string; conversionActionResourceName: string; conversionDateTime: string; value?: number; currencyCode?: string },
    loginCustomerId?: string
  ): Promise<void> {
    const access = await this.refreshAccessToken(refreshToken);
    const body: any = {
      conversions: [{
        gclid: input.gclid,
        conversionAction: input.conversionActionResourceName,
        conversionDateTime: input.conversionDateTime,
        ...(input.value != null ? { conversionValue: input.value, currencyCode: input.currencyCode || 'USD' } : {}),
      }],
      partialFailure: true,
    };
    const res = await axios.post(
      `${ADS_API}/customers/${customerId}:uploadClickConversions`,
      body,
      { headers: { ...this.apiHeaders(access, loginCustomerId), 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    const pfe = res.data?.partialFailureError;
    if (pfe) logger.warn('GoogleAdsService.uploadClickConversion partial failure', { gclid: input.gclid, message: pfe.message });
  }

  /** Set the campaign's radius (proximity) location targeting — replaces any existing proximity so a
   *  radius edit doesn't stack. Without this a Search campaign serves untargeted (nationwide), wasting
   *  a local shop's budget. Idempotent (remove existing PROXIMITY criteria + add the new one). */
  async setLocationTargeting(customerId: string, refreshToken: string, campaignId: string, input: { lat: number; lng: number; radiusMiles: number }, loginCustomerId?: string): Promise<void> {
    const access = await this.refreshAccessToken(refreshToken);
    const existing = await this.search(customerId, access, loginCustomerId,
      `SELECT campaign_criterion.resource_name FROM campaign_criterion ` +
      `WHERE campaign.id = ${String(campaignId).replace(/\D/g, '')} AND campaign_criterion.type = 'PROXIMITY' AND campaign_criterion.status != 'REMOVED'`);
    const ops: any[] = existing.map((r: any) => ({ remove: r.campaignCriterion.resourceName }));
    ops.push({ create: proximityCriterion(customerId, campaignId, input.lat, input.lng, input.radiusMiles) });
    await this.mutate(customerId, access, 'campaignCriteria', ops, true, loginCustomerId);
  }

  /** Composer read: fetch the current RSA copy + keywords for an ad group FROM Google (populate /
   *  reflect). Returns the mapped content. */
  async fetchAdContent(customerId: string, refreshToken: string, adGroupId: string, loginCustomerId?: string): Promise<{ headlines: string[]; descriptions: string[]; keywords: string[]; finalUrl: string | null; adId: string | null }> {
    const access = await this.refreshAccessToken(refreshToken);
    const id = String(adGroupId).replace(/\D/g, '');
    const [adRows, kwRows] = await Promise.all([
      this.search(customerId, access, loginCustomerId,
        `SELECT ad_group_ad.resource_name, ad_group_ad.ad.responsive_search_ad.headlines, ` +
        `ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.final_urls ` +
        `FROM ad_group_ad WHERE ad_group.id = ${id} AND ad_group_ad.status != 'REMOVED'`),
      this.search(customerId, access, loginCustomerId,
        `SELECT ad_group_criterion.keyword.text FROM ad_group_criterion ` +
        `WHERE ad_group.id = ${id} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`),
    ]);
    return mapAdContentRows(adRows, kwRows);
  }

  /** Composer: update the campaign's daily budget (micros). budgetId is the resource id stored at build. */
  async updateCampaignBudget(customerId: string, refreshToken: string, budgetId: string, dailyBudgetMicros: number, loginCustomerId?: string): Promise<void> {
    const access = await this.refreshAccessToken(refreshToken);
    await this.mutate(customerId, access, 'campaignBudgets', [
      { update: { resourceName: `customers/${customerId}/campaignBudgets/${budgetId}`, amountMicros: String(dailyBudgetMicros) }, updateMask: 'amount_micros' },
    ], false, loginCustomerId);
  }

  /** Composer: replace the RSA (ads are immutable) — create a fresh PAUSED responsive search ad from
   *  the edited headlines/descriptions, then remove the old one. Returns the new ad resource name. */
  async replaceResponsiveSearchAd(
    customerId: string, refreshToken: string, adGroupResourceName: string, oldAdResourceName: string | null,
    input: { headlines: string[]; descriptions: string[]; finalUrl: string }, loginCustomerId?: string
  ): Promise<{ adResourceName: string }> {
    const access = await this.refreshAccessToken(refreshToken);
    const created = await this.mutate(customerId, access, 'adGroupAds', [
      { create: {
        adGroup: adGroupResourceName,
        status: 'PAUSED',
        ad: { finalUrls: [input.finalUrl], responsiveSearchAd: {
          headlines: input.headlines.slice(0, 15).map((t) => ({ text: t })),
          descriptions: input.descriptions.slice(0, 4).map((t) => ({ text: t })),
        } },
      } },
    ], false, loginCustomerId);
    const adResourceName = created[0].resourceName as string;
    if (oldAdResourceName && oldAdResourceName !== adResourceName) {
      await this.mutate(customerId, access, 'adGroupAds', [{ remove: oldAdResourceName }], true, loginCustomerId).catch(() => undefined);
    }
    return { adResourceName };
  }

  /** Composer: reconcile the ad group's keywords to `desired` — add missing, remove extra. BROAD match
   *  (as at build). partial-failure so a policy-flagged term skips. Returns the applied keyword set. */
  async reconcileKeywords(customerId: string, refreshToken: string, adGroupId: string, adGroupResourceName: string, desired: string[], loginCustomerId?: string): Promise<{ keywords: string[] }> {
    const access = await this.refreshAccessToken(refreshToken);
    const want = Array.from(new Set((desired || []).map((k) => k.trim()).filter(Boolean).slice(0, 20)));
    const rows = await this.search(customerId, access, loginCustomerId,
      `SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text FROM ad_group_criterion ` +
      `WHERE ad_group.id = ${adGroupId} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`);
    const current = new Map<string, string>(); // lowercased text → resource name
    for (const r of rows) { const t = r.adGroupCriterion?.keyword?.text; if (t) current.set(String(t).toLowerCase(), r.adGroupCriterion.resourceName); }
    const wantLower = new Set(want.map((k) => k.toLowerCase()));
    const toAdd = want.filter((k) => !current.has(k.toLowerCase()));
    const toRemove = [...current.entries()].filter(([t]) => !wantLower.has(t)).map(([, rn]) => rn);
    const ops: any[] = [
      ...toAdd.map((k) => ({ create: { adGroup: adGroupResourceName, status: 'ENABLED', keyword: { text: k, matchType: 'BROAD' } } })),
      ...toRemove.map((rn) => ({ remove: rn })),
    ];
    if (ops.length) await this.mutate(customerId, access, 'adGroupCriteria', ops, true, loginCustomerId);
    return { keywords: want };
  }

  /** Per-call login-customer-id (the shop's manager) takes precedence; falls back to the global env. */
  private apiHeaders(accessToken: string, loginCustomerId?: string): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': this.developerToken(),
    };
    const login = (loginCustomerId || '').replace(/\D/g, '') || this.loginCustomerId();
    if (login) h['login-customer-id'] = login;
    return h;
  }

  /** GAQL search against a customer (optionally through a manager via loginCustomerId). */
  private async search(customerId: string, accessToken: string, loginCustomerId: string | undefined, query: string): Promise<any[]> {
    const res = await axios.post(
      `${ADS_API}/customers/${customerId}/googleAds:search`,
      { query },
      { headers: { ...this.apiHeaders(accessToken, loginCustomerId), 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return res.data?.results || [];
  }

  /** Selectable ad accounts (non-managers, with descriptive names) — expands each accessible customer's
   *  manager tree via customer_client, so client sub-accounts (which listAccessibleCustomers omits) are
   *  pickable. Each carries the managerId to operate through (login-customer-id); null = directly accessible. */
  async listSelectableAccounts(accessToken: string): Promise<Array<{ customerId: string; name: string; managerId: string | null }>> {
    const top = await this.listAccessibleCustomers(accessToken);
    const out: Array<{ customerId: string; name: string; managerId: string | null }> = [];
    const seen = new Set<string>();
    for (const c of top) {
      try {
        const rows = await this.search(c.customerId, accessToken, c.customerId,
          'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager FROM customer_client');
        for (const r of rows) {
          const cc = r.customerClient || {};
          const id = String(cc.id);
          if (!id || cc.manager === true) continue; // managers can't run campaigns
          if (seen.has(id)) continue; seen.add(id);
          out.push({ customerId: id, name: cc.descriptiveName || id, managerId: id === c.customerId ? null : c.customerId });
        }
      } catch {
        // Not a manager / no expansion — treat the top-level customer itself as a directly-usable account.
        if (!seen.has(c.customerId)) { seen.add(c.customerId); out.push({ customerId: c.customerId, name: c.name, managerId: null }); }
      }
    }
    return out;
  }
}

export const googleAdsService = new GoogleAdsService();
