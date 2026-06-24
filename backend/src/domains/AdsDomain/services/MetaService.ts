// backend/src/domains/AdsDomain/services/MetaService.ts
//
// Ads System Stage 4 — Meta Graph API surface. The shop-connect flow (OAuth token exchange,
// ad-account/Page listing, token refresh) IS implemented here; it runs once a registered
// FixFlow Meta App is configured (META_APP_ID/META_APP_SECRET) — gate via `isConfigured()`.
// `fetchLeadFields` / `syncInsights` (campaign-push/insights slice) remain stubs pending the
// later Stage-4 build. The Meta WEBHOOK (MetaWebhookService) is built + tested separately.
// See docs/tasks/strategy/ads-system/ads-connect-meta-shop-flow-implementation-plan.md.

import axios from 'axios';
import { logger } from '../../../utils/logger';

// Graph API version. Default v19.0 — the version our creative push is PROVEN working on
// (live creative created 2026-06-18). Bumping to v22.0 regressed adcreatives create (error
// 2490472 "creative is invalid", even with enhancements off), so v22 stays OPT-IN via
// META_GRAPH_VERSION for Advantage+ enhancement testing (where v22's individual-feature model
// + auto-remove-ineligible behavior lives) — not the default until the v22 creative format is sorted.
const GRAPH_VERSION = (process.env.META_GRAPH_VERSION || 'v19.0').trim();
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
// Advantage+ individual creative_features_spec enhancements only exist on v22+. On older
// versions sending them makes the whole creative invalid (error 2490472 "Creative Invalid for
// Text Generation"), so we skip enhancements unless the version supports them.
const GRAPH_MAJOR = parseInt(GRAPH_VERSION.replace(/^v/, ''), 10) || 0;
const SUPPORTS_CREATIVE_ENHANCEMENTS = GRAPH_MAJOR >= 22;

// Scopes the connect + push flow requests. `pages_manage_ads` powers page-linked ad creatives.
// `leads_retrieval` (native instant lead forms) is EXCLUDED for now — it isn't yet enabled on
// the app's Marketing API use case; requesting it would 400 ("Invalid Scopes"). The push falls
// back to a link creative without it. Re-add it here once it's added to the use case (or set
// META_OAUTH_SCOPES to override per environment — no code change needed).
const DEFAULT_SCOPES = [
  'business_management', 'ads_management', 'ads_read',
  'pages_show_list', 'pages_read_engagement', 'pages_manage_ads',
].join(',');
const SCOPES = process.env.META_OAUTH_SCOPES || DEFAULT_SCOPES;

export interface MetaTokenResult { token: string; expiresAt: Date | null; }
export interface MetaAdAccount { id: string; accountId: string; name: string; status?: number; }
export interface MetaPage { id: string; name: string; accessToken: string; }

export class MetaService {
  /** True when the app credentials are present (gates the OAuth/Insights flows). */
  isConfigured(): boolean {
    return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }

  private requireConfig(): { appId: string; appSecret: string } {
    // Trim — .env values can carry stray spaces / trailing CR (Windows), which break the
    // exact-match token exchange even though the (secret-less) authorize step succeeds.
    const appId = (process.env.META_APP_ID || '').trim();
    const appSecret = (process.env.META_APP_SECRET || '').trim();
    if (!appId || !appSecret) throw new Error('Meta App not configured (META_APP_ID/META_APP_SECRET)');
    return { appId, appSecret };
  }

  /** Surface Facebook's Graph error detail for logs/toasts (instead of a generic axios message).
   *  Meta puts the human-readable cause in error_user_msg/title — include it when present. */
  private fbError(err: any): string {
    const e = err?.response?.data?.error;
    if (!e) return err?.message || 'unknown error';
    const code = e.code ? ` (code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ''})` : '';
    const human = e.error_user_msg || e.error_user_title;
    // Surface which field Meta blamed (e.g. 2490472 "creative is invalid" puts the real reason
    // in error_data.blame_field_specs / error_data, not in the top-level message).
    let blame = '';
    const ed = e.error_data;
    if (ed) {
      const spec = (ed && typeof ed === 'object' && ed.blame_field_specs) ? ed.blame_field_specs : ed;
      try { const s = typeof spec === 'string' ? spec : JSON.stringify(spec); if (s && s !== '{}' && s !== '""') blame = ` [blame: ${s}]`; } catch { /* ignore */ }
    }
    return `${e.message || e.type || 'graph_error'}${code}${human ? ` — ${human}` : ''}${blame}`;
  }

  /** Build the Meta OAuth dialog URL a shop is redirected to. Real (no API call). */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: (process.env.META_APP_ID || '').trim(),
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
      response_type: 'code',
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /** Exchange an OAuth code for a LONG-LIVED user token (short-lived → fb_exchange_token). */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<MetaTokenResult> {
    const { appId, appSecret } = this.requireConfig();
    const redirect = (redirectUri || '').trim();
    try {
      // 1) code → short-lived token (redirect_uri must EXACTLY match the authorize step)
      const short = await axios.get(`${GRAPH}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, redirect_uri: redirect, code },
        timeout: 15000,
      });
      const shortToken = short.data?.access_token;
      if (!shortToken) throw new Error('Meta token exchange returned no access_token');
      // 2) short-lived → long-lived (~60d)
      const long = await axios.get(`${GRAPH}/oauth/access_token`, {
        params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken },
        timeout: 15000,
      });
      const token = long.data?.access_token || shortToken;
      const expiresIn = Number(long.data?.expires_in ?? 0);
      return { token, expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null };
    } catch (err: any) {
      logger.error('MetaService.exchangeCodeForToken failed', { detail: err?.response?.data || err?.message, redirect });
      throw new Error(`exchange_failed: ${this.fbError(err)}`);
    }
  }

  /** Re-extend a long-lived user token before it expires. */
  async refreshToken(longLivedToken: string): Promise<MetaTokenResult> {
    const { appId, appSecret } = this.requireConfig();
    const res = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: longLivedToken },
      timeout: 15000,
    });
    const token = res.data?.access_token;
    if (!token) throw new Error('Meta token refresh returned no access_token');
    const expiresIn = Number(res.data?.expires_in ?? 0);
    return { token, expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null };
  }

  /** The authorizing user's Meta id (stored so deauthorize/data-deletion callbacks map to the shop). */
  async getMe(userToken: string): Promise<string | null> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/me`, { params: { fields: 'id', access_token: userToken }, timeout: 15000 });
      return res.data?.id ? String(res.data.id) : null;
    } catch (err) {
      logger.warn('MetaService.getMe failed (non-fatal)');
      return null;
    }
  }

  /** List the user's ad accounts (for the in-app picker). */
  async listAdAccounts(userToken: string): Promise<MetaAdAccount[]> {
    this.requireConfig();
    const res = await axios.get(`${GRAPH}/me/adaccounts`, {
      params: { fields: 'account_id,name,account_status', access_token: userToken, limit: 100 },
      timeout: 15000,
    });
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    return data.map((a: any) => ({
      id: String(a.id),                       // act_<id>
      accountId: String(a.account_id ?? ''),
      name: String(a.name ?? a.account_id ?? a.id),
      status: typeof a.account_status === 'number' ? a.account_status : undefined,
    }));
  }

  /** List the user's Pages (incl. per-Page access tokens) for the picker / lead ads. */
  async listPages(userToken: string): Promise<MetaPage[]> {
    this.requireConfig();
    const res = await axios.get(`${GRAPH}/me/accounts`, {
      params: { fields: 'id,name,access_token', access_token: userToken, limit: 100 },
      timeout: 15000,
    });
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    return data.map((p: any) => ({ id: String(p.id), name: String(p.name ?? p.id), accessToken: String(p.access_token ?? '') }));
  }

  // --- Stage-4 PUSH: create objects on the shop's ad account (user token w/ ads_management) ---

  /** Account status + funding + currency context. account_status 1 = ACTIVE.
   *  `currency` is the ISO code (e.g. USD, PHP); `minDailyBudget` is Meta's minimum daily
   *  budget for THIS account, in the account-currency minor units (the same unit a budget is
   *  sent in) — used to validate before a push so we surface a clear error, not a raw Graph one. */
  async getAccountStatus(adAccountId: string, userToken: string): Promise<{
    accountStatus: number; hasFunding: boolean; currency: string | null; minDailyBudget: number | null;
  }> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${adAccountId}`, {
        params: { fields: 'account_status,funding_source,currency,min_daily_budget', access_token: userToken },
        timeout: 15000,
      });
      const min = res.data?.min_daily_budget;
      return {
        accountStatus: Number(res.data?.account_status ?? 0),
        hasFunding: !!res.data?.funding_source,
        currency: res.data?.currency ?? null,
        minDailyBudget: min != null ? Number(min) : null,
      };
    } catch (err: any) {
      logger.error('MetaService.getAccountStatus failed', { detail: err?.response?.data || err?.message });
      throw new Error(`account_status_failed: ${this.fbError(err)}`);
    }
  }

  /** Read a campaign's current config from Meta (two-way config sync). `status` is the configured
   *  status (ACTIVE/PAUSED/ARCHIVED/DELETED); `effectiveStatus` is the computed delivery state. */
  async getCampaign(campaignId: string, userToken: string): Promise<{
    objective: string | null; status: string | null; effectiveStatus: string | null; name: string | null;
  }> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${campaignId}`, {
        params: { fields: 'objective,status,effective_status,name', access_token: userToken },
        timeout: 15000,
      });
      return {
        objective: res.data?.objective ?? null,
        status: res.data?.status ?? null,
        effectiveStatus: res.data?.effective_status ?? null,
        name: res.data?.name ?? null,
      };
    } catch (err: any) {
      logger.error('MetaService.getCampaign failed', { detail: err?.response?.data || err?.message });
      throw new Error(`get_campaign_failed: ${this.fbError(err)}`);
    }
  }

  /** Read an ad set's current config from Meta (two-way config sync). `dailyBudgetCents` is in the
   *  account-currency minor units (the same unit we send). */
  async getAdSet(adsetId: string, userToken: string): Promise<{
    dailyBudgetCents: number | null; optimizationGoal: string | null; status: string | null; effectiveStatus: string | null;
    targeting: any | null;
  }> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${adsetId}`, {
        params: { fields: 'daily_budget,optimization_goal,status,effective_status,targeting', access_token: userToken },
        timeout: 15000,
      });
      const db = res.data?.daily_budget;
      return {
        dailyBudgetCents: db != null && db !== '' ? Number(db) : null,
        optimizationGoal: res.data?.optimization_goal ?? null,
        status: res.data?.status ?? null,
        effectiveStatus: res.data?.effective_status ?? null,
        targeting: res.data?.targeting ?? null,
      };
    } catch (err: any) {
      logger.error('MetaService.getAdSet failed', { detail: err?.response?.data || err?.message });
      throw new Error(`get_adset_failed: ${this.fbError(err)}`);
    }
  }

  /** Read a live ad's current status + bound creative id (two-way config sync, Phase 2). Used to
   *  detect a creative swapped/edited directly in Ads Manager: when `creativeId` ≠ the creative id
   *  we pushed, the creative diverged and we reflect+flag it. */
  async getAd(adId: string, userToken: string): Promise<{ status: string | null; creativeId: string | null }> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${adId}`, {
        params: { fields: 'status,creative{id}', access_token: userToken },
        timeout: 15000,
      });
      const cid = res.data?.creative?.id;
      return { status: res.data?.status ?? null, creativeId: cid != null ? String(cid) : null };
    } catch (err: any) {
      logger.error('MetaService.getAd failed', { detail: err?.response?.data || err?.message });
      throw new Error(`get_ad_failed: ${this.fbError(err)}`);
    }
  }

  /** Return the ad account's existing Meta Pixel id, or CREATE one ("FixFlow Lead Tracking")
   *  if none exists. Used so the landing page can fire a "Lead" conversion attributed to the
   *  shop's ad account. Throws on a Graph error (caller treats as best-effort). */
  async ensureAdPixel(adAccountId: string, userToken: string): Promise<string> {
    this.requireConfig();
    try {
      const existing = await axios.get(`${GRAPH}/${adAccountId}/adspixels`, {
        params: { fields: 'id,name', limit: 1, access_token: userToken }, timeout: 15000,
      });
      const found = existing.data?.data?.[0]?.id;
      if (found) return String(found);
      const created = await axios.post(`${GRAPH}/${adAccountId}/adspixels`, null, {
        params: { name: 'FixFlow Lead Tracking', access_token: userToken }, timeout: 15000,
      });
      return String(created.data?.id);
    } catch (err: any) {
      logger.error('MetaService.ensureAdPixel failed', { detail: err?.response?.data || err?.message });
      throw new Error(`pixel_failed: ${this.fbError(err)}`);
    }
  }

  /** Create a PAUSED campaign; returns the Meta campaign id. special_ad_categories must be a
   *  JSON array — ['NONE'] for an ordinary (non housing/employment/credit) campaign. */
  async createCampaign(adAccountId: string, userToken: string, opts: { name: string; objective: string }): Promise<string> {
    return this.create(`${adAccountId}/campaigns`, userToken, {
      name: opts.name, objective: opts.objective, status: 'PAUSED',
      special_ad_categories: JSON.stringify(['NONE']),
      // Budget lives on the ad set (no campaign budget) → Meta requires this flag. false =
      // ad sets don't share budget (predictable per-ad-set spend).
      is_adset_budget_sharing_enabled: false,
    });
  }

  /** Create a PAUSED ad set (budget + geo/audience + optimization); returns the ad-set id. */
  async createAdSet(adAccountId: string, userToken: string, opts: {
    name: string; campaignId: string; dailyBudgetCents: number; optimizationGoal: string;
    billingEvent: string; targeting: Record<string, any>; promotedPageId?: string;
    /** When optimizing for a pixel conversion (OFFSITE_CONVERSIONS), the ad set's promoted_object
     *  must name the pixel + the standard event to optimize toward. Takes precedence over page. */
    conversionPixelId?: string; customEventType?: string;
  }): Promise<string> {
    const body: Record<string, any> = {
      name: opts.name,
      campaign_id: opts.campaignId,
      daily_budget: String(opts.dailyBudgetCents),
      billing_event: opts.billingEvent,
      optimization_goal: opts.optimizationGoal,
      // Automatic bidding ("Highest volume") — no bid amount/cap required. Without an explicit
      // strategy Meta defaults to one that demands a bid_amount → 100/2490487.
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      targeting: JSON.stringify(opts.targeting),
      status: 'PAUSED',
    };
    // Lead-gen optimization uses a native instant form on the ad (ON_AD destination) — required
    // so a creative carrying a lead_gen_form_id is accepted (else Meta 100/1892040).
    if (opts.optimizationGoal === 'LEAD_GENERATION') body.destination_type = 'ON_AD';
    // promoted_object: a pixel conversion (OFFSITE_CONVERSIONS) takes precedence over the page —
    // Meta requires { pixel_id, custom_event_type } to optimize toward the Lead event.
    if (opts.conversionPixelId) {
      body.promoted_object = JSON.stringify({
        pixel_id: opts.conversionPixelId,
        custom_event_type: opts.customEventType || 'LEAD',
      });
    } else if (opts.promotedPageId) {
      body.promoted_object = JSON.stringify({ page_id: opts.promotedPageId });
    }
    return this.create(`${adAccountId}/adsets`, userToken, body);
  }

  /** Create an ad creative (link_data: image + copy + CTA). When `leadFormId` is given the CTA
   *  opens the native instant lead form (SIGN_UP); otherwise it links out (LEARN_MORE). */
  async createAdCreative(adAccountId: string, userToken: string, opts: {
    pageId: string; imageUrl: string; headline: string; message: string; linkUrl: string;
    callToAction?: string; leadFormId?: string;
    /** Opt into Meta Advantage+ standard creative enhancements (image expansion, background
     *  gen, text variations) on top of our approved creative. Default off (brand-safe). */
    enhancements?: boolean;
  }): Promise<string> {
    const call_to_action = opts.leadFormId
      ? { type: 'SIGN_UP', value: { lead_gen_form_id: opts.leadFormId, link: opts.linkUrl } }
      : { type: opts.callToAction ?? 'LEARN_MORE', value: { link: opts.linkUrl } };
    const objectStorySpec = {
      page_id: opts.pageId,
      link_data: {
        picture: opts.imageUrl,
        link: opts.linkUrl,
        message: opts.message,
        name: opts.headline,
        call_to_action,
      },
    };
    const body: Record<string, any> = {
      name: `${opts.headline} — creative`.slice(0, 100),
      object_story_spec: JSON.stringify(objectStorySpec),
    };
    // Advantage+ creative enhancements — opt-in only (exec Part 4). Meta optimizes variations
    // AFTER our approval; off by default so nothing reaches delivery un-reviewed.
    // NOTE: the umbrella `standard_enhancements` field is DEPRECATED (Meta error 3858504) — you
    // must opt into INDIVIDUAL features. Which features are eligible varies by account/objective
    // (the open research task), so the set is env-tunable via ADS_META_ENHANCEMENT_FEATURES.
    if (opts.enhancements && SUPPORTS_CREATIVE_ENHANCEMENTS) {
      // Default = subtle, broadly-ELIGIBLE features only. A single ineligible feature invalidates
      // the WHOLE creative (Meta does NOT auto-drop, e.g. text_generation → "Creative Invalid for
      // Text Generation", image_background_gen → "No catalog selected"). Verified eligible for our
      // test account: image_brightness_and_contrast, image_touchups, enhance_cta (+ image_enhancement,
      // image_auto_crop, image_uncrop, adapt_to_placement, text_optimizations, image_templates).
      // Override per account via ADS_META_ENHANCEMENT_FEATURES.
      const features = (process.env.ADS_META_ENHANCEMENT_FEATURES
        || 'image_brightness_and_contrast,image_touchups,enhance_cta')
        .split(',').map((f) => f.trim()).filter(Boolean);
      const creative_features_spec: Record<string, any> = {};
      for (const f of features) creative_features_spec[f] = { enroll_status: 'OPT_IN' };
      body.degrees_of_freedom_spec = JSON.stringify({ creative_features_spec });
    } else if (opts.enhancements) {
      // Flag is on but the Graph version can't do individual enhancements — skip rather than
      // send an invalid creative. Set META_GRAPH_VERSION=v22.0 to actually apply them.
      logger.warn(`createAdCreative: enhancements requested but Graph ${GRAPH_VERSION} lacks individual creative_features_spec — skipping (set META_GRAPH_VERSION=v22.0).`);
    }
    return this.create(`${adAccountId}/adcreatives`, userToken, body);
  }

  /** Whether the Page has accepted Meta's Lead Generation Terms of Service (required before
   *  lead ads can run). Best-effort — returns false on error so the UI prompts the shop. */
  async getPageLeadgenTosAccepted(pageId: string, pageToken: string): Promise<boolean> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${pageId}`, {
        params: { fields: 'leadgen_tos_accepted', access_token: pageToken }, timeout: 15000,
      });
      return res.data?.leadgen_tos_accepted === true;
    } catch (err: any) {
      logger.warn(`MetaService.getPageLeadgenTosAccepted failed: ${this.fbError(err)}`);
      return false;
    }
  }

  /** Set a Meta object's status (ACTIVE|PAUSED). Used for pause/activate + safeguard sync. */
  async setObjectStatus(objectId: string, status: 'ACTIVE' | 'PAUSED', userToken: string): Promise<void> {
    this.requireConfig();
    try {
      await axios.post(`${GRAPH}/${objectId}`, null, { params: { status, access_token: userToken }, timeout: 15000 });
    } catch (err: any) {
      logger.error('MetaService.setObjectStatus failed', { detail: err?.response?.data || err?.message, objectId, status });
      throw new Error(`status_update_failed (${objectId}): ${this.fbError(err)}`);
    }
  }

  /** Update an ad set's budget / targeting (Phase 5 in-app edits). No-op if nothing to set. */
  async updateAdSet(adsetId: string, userToken: string, opts: { dailyBudgetCents?: number; targeting?: Record<string, any> }): Promise<void> {
    const body: Record<string, any> = {};
    if (opts.dailyBudgetCents != null) body.daily_budget = String(opts.dailyBudgetCents);
    if (opts.targeting) body.targeting = JSON.stringify(opts.targeting);
    if (Object.keys(body).length === 0) return;
    this.requireConfig();
    try {
      await axios.post(`${GRAPH}/${adsetId}`, null, { params: { ...body, access_token: userToken }, timeout: 15000 });
    } catch (err: any) {
      logger.error('MetaService.updateAdSet failed', { detail: err?.response?.data || err?.message, adsetId });
      throw new Error(`adset_update_failed: ${this.fbError(err)}`);
    }
  }

  /** Point an ad at a (new) creative — creatives are immutable, so edits = new creative + this. */
  async updateAdCreative(adId: string, userToken: string, creativeId: string): Promise<void> {
    this.requireConfig();
    try {
      await axios.post(`${GRAPH}/${adId}`, null, { params: { creative: JSON.stringify({ creative_id: creativeId }), access_token: userToken }, timeout: 15000 });
    } catch (err: any) {
      logger.error('MetaService.updateAdCreative failed', { detail: err?.response?.data || err?.message, adId });
      throw new Error(`ad_update_failed: ${this.fbError(err)}`);
    }
  }

  /** Read a creative's current image/headline/copy/link (to rebuild on a text-only edit). */
  async getCreativeSpec(creativeId: string, userToken: string): Promise<{ picture: string; headline: string; message: string; link: string } | null> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${creativeId}`, { params: { fields: 'object_story_spec', access_token: userToken }, timeout: 15000 });
      const ld = res.data?.object_story_spec?.link_data;
      if (!ld) return null;
      return { picture: String(ld.picture ?? ''), headline: String(ld.name ?? ''), message: String(ld.message ?? ''), link: String(ld.link ?? '') };
    } catch (err: any) {
      logger.warn(`MetaService.getCreativeSpec failed: ${this.fbError(err)}`);
      return null;
    }
  }

  /** Create a basic leadgen instant form (name/email/phone) on the Page; returns its id.
   *  Uses the PAGE token (not the user token). Leads arrive via the existing webhook. */
  async ensureLeadForm(pageId: string, pageToken: string, opts: { name: string; privacyPolicyUrl: string }): Promise<string> {
    return this.create(`${pageId}/leadgen_forms`, pageToken, {
      name: opts.name.slice(0, 200),
      questions: JSON.stringify([{ type: 'FULL_NAME' }, { type: 'EMAIL' }, { type: 'PHONE' }]),
      privacy_policy: JSON.stringify({ url: opts.privacyPolicyUrl, link_text: 'Privacy Policy' }),
      follow_up_action_url: opts.privacyPolicyUrl,
      locale: 'en_US',
    });
  }

  /** Create a PAUSED ad linking an ad set to a creative; returns the ad id. */
  async createAd(adAccountId: string, userToken: string, opts: { name: string; adsetId: string; creativeId: string }): Promise<string> {
    return this.create(`${adAccountId}/ads`, userToken, {
      name: opts.name,
      adset_id: opts.adsetId,
      creative: JSON.stringify({ creative_id: opts.creativeId }),
      status: 'PAUSED',
    });
  }

  /** Delete a created Meta object (rollback on partial-failure). Best-effort. */
  async deleteObject(objectId: string, userToken: string): Promise<void> {
    try { await axios.delete(`${GRAPH}/${objectId}`, { params: { access_token: userToken }, timeout: 15000 }); }
    catch (err: any) { logger.warn(`MetaService.deleteObject ${objectId} failed (rollback best-effort): ${this.fbError(err)}`); }
  }

  /** Shared POST → returns the created object id; throws a descriptive error on failure. */
  private async create(edge: string, userToken: string, body: Record<string, any>): Promise<string> {
    this.requireConfig();
    let res;
    try {
      res = await axios.post(`${GRAPH}/${edge}`, null, { params: { ...body, access_token: userToken }, timeout: 20000 });
    } catch (err: any) {
      logger.error(`MetaService.create ${edge} failed`, { detail: err?.response?.data || err?.message });
      throw new Error(`meta_create_failed (${edge}): ${this.fbError(err)}`);
    }
    // Meta sometimes returns HTTP 200 with an ERROR BODY (e.g. account security checkpoint
    // code 31 "Please authenticate your account") — axios doesn't throw, so surface it here
    // instead of the misleading "returned no id".
    if (res.data?.error) {
      logger.error(`MetaService.create ${edge} returned error body`, { detail: res.data });
      throw new Error(`meta_create_failed (${edge}): ${this.fbError({ response: { data: res.data } })}`);
    }
    const id = res.data?.id;
    if (!id) throw new Error(`meta_create_failed (${edge}): no id returned — response: ${JSON.stringify(res.data)}`);
    return String(id);
  }

  /** Fetch daily campaign insights (spend/impressions/clicks) for the window. Returns the
   *  raw Meta `data` rows (mapped by metaInsights.mapInsights). Phase 3. */
  async fetchCampaignInsights(metaCampaignId: string, userToken: string, datePreset = 'last_7d'): Promise<any[]> {
    this.requireConfig();
    try {
      const res = await axios.get(`${GRAPH}/${metaCampaignId}/insights`, {
        params: { fields: 'spend,impressions,clicks', level: 'campaign', time_increment: 1, date_preset: datePreset, access_token: userToken },
        timeout: 20000,
      });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    } catch (err: any) {
      logger.error('MetaService.fetchCampaignInsights failed', { detail: err?.response?.data || err?.message, metaCampaignId });
      throw new Error(`insights_failed: ${this.fbError(err)}`);
    }
  }

  // --- Lead-field fetch — separate later phase. STUB. ---

  /** Fetch a lead's full fields (name/phone/email) by leadgen_id + page token. */
  async fetchLeadFields(_leadgenId: string, _pageToken: string): Promise<never> {
    logger.warn('MetaService.fetchLeadFields not implemented — Phase 4 lead-form slice');
    throw new Error('Meta lead fetch not implemented — requires the Phase-4 lead-form build');
  }
}

export const metaService = new MetaService();
