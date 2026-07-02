// backend/src/domains/AdsDomain/controllers/GoogleConnectController.ts
//
// Shop-side "Connect Google" flow (Google plan, Slice 1). The shop authorizes FixFlow via Google
// OAuth to run ads on ITS OWN Google Ads account; we store the encrypted refresh token, let the shop
// pick a customer account, and flip the google_ads_connected gate. Gated by ADS_GOOGLE_CONNECT_ENABLED
// + a configured Google app. Mirrors MetaConnectController; reuses the OAuth state + token-crypto utils.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { googleAdsService } from '../services/GoogleAdsService';
import { googleInsightsService } from '../services/GoogleInsightsService';
import { signState, verifyStateDetailed } from '../services/metaOAuthState';
import { encryptToken, decryptToken } from '../../../utils/tokenCrypto';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';

const connections = new GoogleConnectionRepository();
const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;
const redirectUri = (): string => (process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
const frontendBase = (): string => (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3001').trim();

function connectEnabled(): boolean {
  return process.env.ADS_GOOGLE_CONNECT_ENABLED === 'true' && googleAdsService.isConfigured();
}
function guard(res: Response): boolean {
  if (!connectEnabled()) {
    res.status(503).json({ success: false, error: 'google_connect_disabled', message: 'Google connect is not enabled yet.' });
    return false;
  }
  if (!redirectUri()) {
    res.status(500).json({ success: false, error: 'google_redirect_not_configured' });
    return false;
  }
  return true;
}

// GET /ads/shop/google/connect — OAuth consent URL (signed state binds it to this shop).
export async function getGoogleConnectUrl(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!guard(res)) return;
  try {
    const authUrl = googleAdsService.getAuthorizationUrl(redirectUri(), signState(shopId));
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    logger.error('GoogleConnectController.getGoogleConnectUrl failed', err);
    res.status(500).json({ success: false, error: 'Failed to start Google connection' });
  }
}

// GET /ads/google/oauth/callback — PUBLIC (browser redirect from Google). shopId from verified state.
export async function handleGoogleOauthCallback(req: Request, res: Response): Promise<void> {
  const base = frontendBase();
  const fail = (reason: string) => res.redirect(`${base}/shop?tab=ads&google=error&reason=${encodeURIComponent(reason)}`);
  if (!connectEnabled() || !redirectUri()) return fail('disabled');

  const { code, state, error } = req.query as Record<string, string>;
  if (error) { logger.warn(`Google OAuth callback error: ${error}`); return fail(error); }
  const sv = verifyStateDetailed(state);
  if (!sv.payload) return fail(`bad_state:${sv.reason}`);
  if (!code) return fail('no_code');

  try {
    const { refreshToken } = await googleAdsService.exchangeCodeForToken(code, redirectUri());
    if (!refreshToken) return fail('no_refresh_token'); // needs prompt=consent + offline (we set both)
    await connections.saveRefreshToken(sv.payload.shopId, encryptToken(refreshToken));
    // Token stored but NOT connected yet — the shop still picks a customer account.
    res.redirect(`${base}/shop?tab=ads&google=select`);
  } catch (err: any) {
    logger.error('GoogleConnectController.handleGoogleOauthCallback failed', err?.message || err);
    fail(err?.message || 'exchange_failed');
  }
}

// GET /ads/shop/google/accounts — list the user's accessible customer accounts for the picker.
export async function listMyGoogleAccounts(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!guard(res)) return;
  try {
    const conn = await connections.getConnection(shopId);
    if (!conn?.refreshTokenEnc) { res.status(409).json({ success: false, error: 'not_authorized', message: 'Connect Google first.' }); return; }
    const accessToken = await googleAdsService.refreshAccessToken(decryptToken(conn.refreshTokenEnc));
    // Expand manager trees so client sub-accounts (which run campaigns) are pickable, with names.
    const accounts = await googleAdsService.listSelectableAccounts(accessToken);
    res.json({ success: true, data: { accounts } });
  } catch (err) {
    logger.error('GoogleConnectController.listMyGoogleAccounts failed', err);
    res.status(502).json({ success: false, error: 'Failed to load Google accounts' });
  }
}

// POST /ads/shop/google/select { customerId } — store the choice + flip the gate on.
export async function selectMyGoogleAccount(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  if (!guard(res)) return;
  const customerId = (req.body?.customerId || '').toString().replace(/\D/g, '');
  if (!customerId) { res.status(400).json({ success: false, error: 'customerId is required' }); return; }
  try {
    const conn = await connections.getConnection(shopId);
    if (!conn?.refreshTokenEnc) { res.status(409).json({ success: false, error: 'not_authorized', message: 'Connect Google first.' }); return; }
    // Validate the pick against the shop's selectable accounts + resolve which manager to operate
    // through (login-customer-id) — from the account itself, not a global env.
    const accessToken = await googleAdsService.refreshAccessToken(decryptToken(conn.refreshTokenEnc));
    const accounts = await googleAdsService.listSelectableAccounts(accessToken);
    const chosen = accounts.find((a) => a.customerId === customerId);
    if (!chosen) {
      res.status(400).json({ success: false, error: 'unknown_customer' });
      return;
    }
    await connections.saveSelection(shopId, customerId, chosen.managerId);
    res.json({ success: true, data: { customerId, connected: true } });
  } catch (err) {
    logger.error('GoogleConnectController.selectMyGoogleAccount failed', err);
    res.status(502).json({ success: false, error: 'Failed to save Google selection' });
  }
}

// GET /ads/shop/google/connection — current connection status for the UI.
export async function getMyGoogleConnection(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const conn = await connections.getConnection(shopId);
    res.json({
      success: true,
      data: {
        enabled: connectEnabled(),
        connected: conn?.connected ?? false,
        hasToken: !!conn?.refreshTokenEnc,
        customerId: conn?.customerId ?? null,
      },
    });
  } catch (err) {
    logger.error('GoogleConnectController.getMyGoogleConnection failed', err);
    res.status(500).json({ success: false, error: 'Failed to load connection' });
  }
}

// POST /ads/google/sync-insights (admin) — run the Google insights import now (also nightly). Slice 4.
export async function triggerGoogleInsightsSync(_req: Request, res: Response): Promise<void> {
  try {
    const synced = await googleInsightsService.syncAll();
    res.json({ success: true, data: { synced } });
  } catch (err) {
    logger.error('GoogleConnectController.triggerGoogleInsightsSync failed', err);
    res.status(500).json({ success: false, error: 'Failed to sync Google insights' });
  }
}

// POST /ads/shop/google/disconnect — clear tokens/selection + drop the gate flag.
export async function disconnectMyGoogle(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    await connections.clearConnection(shopId);
    res.json({ success: true });
  } catch (err) {
    logger.error('GoogleConnectController.disconnectMyGoogle failed', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
}
