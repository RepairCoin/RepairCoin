// backend/src/domains/AdsDomain/controllers/MetaConnectController.ts
//
// Shop-side "Connect Meta" flow (Stage-4 connect slice). The shop authorizes FixFlow via
// Facebook Login OAuth to run ads on ITS OWN Meta ad account; we store the encrypted token,
// let the shop pick an ad account + Page, and flip the §9.6 `ads_account_connected` gate.
// Gated by ADS_META_CONNECT_ENABLED + a configured Meta App; until then the admin-flip stays.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { metaService } from '../services/MetaService';
import { signState, verifyStateDetailed } from '../services/metaOAuthState';
import { encryptToken, decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { AdMessageRepository } from '../repositories/AdMessageRepository';
import { metaConnectionService } from '../services/MetaConnectionService';
import { metaInsightsService } from '../services/MetaInsightsService';
import { metaPushService } from '../services/MetaPushService';

const connections = new MetaConnectionRepository();
const campaigns = new CampaignRepository();
const messages = new AdMessageRepository();

const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;
const redirectUri = (): string => (process.env.META_OAUTH_REDIRECT_URI || '').trim();
const frontendBase = (): string => (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3001').trim();
const postEvent = (shopId: string, body: string) => messages.postEvent(shopId, body).catch((e) => logger.error('Meta connect postEvent failed', e));

/** True when the connect flow is enabled AND a Meta App is configured. */
function connectEnabled(): boolean {
  return process.env.ADS_META_CONNECT_ENABLED === 'true' && metaService.isConfigured();
}
function guard(res: Response): boolean {
  if (!connectEnabled()) {
    res.status(503).json({ success: false, error: 'meta_connect_disabled', message: 'Meta connect is not enabled yet.' });
    return false;
  }
  if (!redirectUri()) {
    res.status(500).json({ success: false, error: 'meta_redirect_not_configured' });
    return false;
  }
  return true;
}

// GET /ads/shop/meta/connect — returns the OAuth dialog URL (signed state binds it to this shop).
export async function getMetaConnectUrl(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!guard(res)) return;
  try {
    const authUrl = metaService.getAuthorizationUrl(redirectUri(), signState(shopId));
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    logger.error('MetaConnectController.getMetaConnectUrl failed', err);
    res.status(500).json({ success: false, error: 'Failed to start Meta connection' });
  }
}

// GET /ads/meta/oauth/callback — PUBLIC (browser redirect from Facebook). shopId comes from
// the verified state, never a param. On success we store the token and bounce to the picker.
export async function handleMetaOauthCallback(req: Request, res: Response): Promise<void> {
  const base = frontendBase();
  const fail = (reason: string) => res.redirect(`${base}/shop?tab=ads&meta=error&reason=${encodeURIComponent(reason)}`);
  if (!connectEnabled() || !redirectUri()) return fail('disabled');

  const { code, state, error } = req.query as Record<string, string>;
  if (error) { logger.warn(`Meta OAuth callback error: ${error}`); return fail(error); }
  const sv = verifyStateDetailed(state);
  if (!sv.payload) return fail(`bad_state:${sv.reason}`); // reason: expired | bad_signature | no_secret | …
  const payload = sv.payload;
  if (!code) return fail('no_code');

  try {
    const { token, expiresAt } = await metaService.exchangeCodeForToken(code, redirectUri());
    const metaUserId = await metaService.getMe(token); // for deauthorize/data-deletion mapping
    await connections.saveUserToken(payload.shopId, encryptToken(token), expiresAt, metaUserId);
    // Token stored but NOT connected yet — the shop still picks an ad account + Page.
    res.redirect(`${base}/shop?tab=ads&meta=select`);
  } catch (err: any) {
    logger.error('MetaConnectController.handleMetaOauthCallback failed', err?.message || err);
    fail(err?.message || 'exchange_failed'); // surfaces Facebook's reason in the toast
  }
}

// GET /ads/shop/meta/accounts — list the user's ad accounts + Pages for the picker.
export async function listMyMetaAccounts(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!guard(res)) return;
  try {
    const conn = await connections.getConnection(shopId);
    if (!conn?.userTokenEnc) { res.status(409).json({ success: false, error: 'not_authorized', message: 'Connect Meta first.' }); return; }
    const userToken = decryptToken(conn.userTokenEnc);
    const [adAccounts, pages] = await Promise.all([
      metaService.listAdAccounts(userToken),
      metaService.listPages(userToken),
    ]);
    // Never expose Page tokens to the client.
    res.json({ success: true, data: { adAccounts, pages: pages.map((p) => ({ id: p.id, name: p.name })) } });
  } catch (err) {
    logger.error('MetaConnectController.listMyMetaAccounts failed', err);
    res.status(502).json({ success: false, error: 'Failed to load Meta accounts' });
  }
}

// POST /ads/shop/meta/select { adAccountId, pageId } — store the choice + flip the gate on.
export async function selectMyMetaAccount(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!guard(res)) return;
  const adAccountId = (req.body?.adAccountId || '').toString().trim();
  const pageId = (req.body?.pageId || '').toString().trim();
  if (!adAccountId || !pageId) { res.status(400).json({ success: false, error: 'adAccountId and pageId are required' }); return; }
  try {
    const conn = await connections.getConnection(shopId);
    if (!conn?.userTokenEnc) { res.status(409).json({ success: false, error: 'not_authorized', message: 'Connect Meta first.' }); return; }
    const userToken = decryptToken(conn.userTokenEnc);
    // Validate the picks against what the user actually has + grab the Page token.
    const [adAccounts, pages] = await Promise.all([metaService.listAdAccounts(userToken), metaService.listPages(userToken)]);
    if (!adAccounts.some((a) => a.id === adAccountId)) { res.status(400).json({ success: false, error: 'unknown_ad_account' }); return; }
    const page = pages.find((p) => p.id === pageId);
    if (!page) { res.status(400).json({ success: false, error: 'unknown_page' }); return; }
    await connections.saveSelection(shopId, adAccountId, pageId, encryptToken(page.accessToken));
    void postEvent(shopId, 'Ad account connected — campaigns can now go live.');
    res.json({ success: true, data: { adAccountId, pageId, connected: true } });
  } catch (err) {
    logger.error('MetaConnectController.selectMyMetaAccount failed', err);
    res.status(502).json({ success: false, error: 'Failed to save Meta selection' });
  }
}

// GET /ads/shop/meta/connection — current connection status for the UI.
export async function getMyMetaConnection(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const conn = await connections.getConnection(shopId);
    // Lead ads need the Page to accept Meta's Lead Gen ToS — surface it so the shop can accept.
    let leadgenTosAccepted: boolean | null = null;
    if (conn?.connected && conn.pageId && conn.pageTokenEnc) {
      try { leadgenTosAccepted = await metaService.getPageLeadgenTosAccepted(conn.pageId, decryptToken(conn.pageTokenEnc)); }
      catch { leadgenTosAccepted = null; }
    }
    res.json({
      success: true,
      data: {
        enabled: connectEnabled(),
        connected: conn?.connected ?? false,
        hasToken: !!conn?.userTokenEnc,
        adAccountId: conn?.adAccountId ?? null,
        pageId: conn?.pageId ?? null,
        leadgenTosAccepted,
      },
    });
  } catch (err) {
    logger.error('MetaConnectController.getMyMetaConnection failed', err);
    res.status(500).json({ success: false, error: 'Failed to load connection' });
  }
}

// POST /ads/shop/meta/disconnect — clear tokens/selection + drop the gate flag.
export async function disconnectMyMeta(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    // Pause any live Meta campaigns first (token still valid), then clear (best-effort).
    try {
      const pushed = (await campaigns.listWithMetaCampaign()).filter((c) => c.shopId === shopId);
      for (const c of pushed) await metaPushService.pushStatus(c.id, 'PAUSED').catch(() => undefined);
    } catch (e) { logger.warn('disconnect: pausing Meta campaigns failed', e); }
    await connections.clearConnection(shopId);
    void postEvent(shopId, 'Ad account disconnected — live campaigns paused.');
    res.json({ success: true });
  } catch (err) {
    logger.error('MetaConnectController.disconnectMyMeta failed', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
}

// POST /ads/meta/deauthorize — PUBLIC. Meta signed_request when a user removes the app.
// Always ack 200 (Meta retries otherwise); the service verifies the signature itself.
export async function handleMetaDeauthorize(req: Request, res: Response): Promise<void> {
  try { await metaConnectionService.handleDeauthorize(req.body?.signed_request); }
  catch (err) { logger.error('MetaConnectController.handleMetaDeauthorize failed', err); }
  res.status(200).json({ success: true });
}

// POST /ads/meta/sync-insights (admin) — run the Meta insights import now (also nightly). Phase 3.
export async function triggerMetaInsightsSync(_req: Request, res: Response): Promise<void> {
  try {
    const synced = await metaInsightsService.syncAll();
    res.json({ success: true, data: { synced } });
  } catch (err) {
    logger.error('MetaConnectController.triggerMetaInsightsSync failed', err);
    res.status(500).json({ success: false, error: 'Failed to sync insights' });
  }
}

// POST /ads/meta/data-deletion — PUBLIC. Meta data-deletion request. Must respond with
// { url, confirmation_code } so Meta can show the user a status link.
export async function handleMetaDataDeletion(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = await metaConnectionService.handleDataDeletion(req.body?.signed_request);
    const code = shopId ? `meta-del-${shopId}` : 'meta-del-unknown';
    res.status(200).json({ url: `${frontendBase()}/meta/data-deletion?code=${encodeURIComponent(code)}`, confirmation_code: code });
  } catch (err) {
    logger.error('MetaConnectController.handleMetaDataDeletion failed', err);
    res.status(200).json({ url: `${frontendBase()}/meta/data-deletion`, confirmation_code: 'meta-del-error' });
  }
}
