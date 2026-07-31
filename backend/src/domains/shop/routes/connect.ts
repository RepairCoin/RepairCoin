import { Router, Request, Response } from 'express';
import { getStripeConnectService } from '../../../services/StripeConnectService';
import { logger } from '../../../utils/logger';
import { authMiddleware } from '../../../middleware/auth';

/**
 * Stripe Connect (Standard, OAuth) for shops — the shop connects/owns its own account
 * (existing or newly created on Stripe's page).
 *
 * Linking only — no application_fee / transfer_data here. See StripeConnectService for
 * why the commission side is the next phase.
 */
const router = Router();

/**
 * Truly-public routes live on their own router. Registering them above this file's
 * `router.use(authMiddleware)` is NOT enough: subscription.ts has a blanket
 * `router.use(authMiddleware)` and is mounted at '/' ahead of this file, so every
 * /api/shops/* request passes through it first and is 401'd before reaching here.
 * A public route must therefore be mounted BEFORE that one — see routes/index.ts.
 */
const publicRouter = Router();

const frontendBase = (): string =>
  (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3001').trim();

// Where a mobile-initiated onboarding flow returns to. Same scheme env var the existing
// Stripe Checkout (RCN purchase) redirect already uses. Path is deliberately nested under
// /shop/payouts/callback — NOT /shared/... — so it matches a real expo-router file
// (app/(dashboard)/shop/payouts/callback.tsx; route groups like (dashboard) are stripped
// from the resolved path).
const mobileDeepLinkBase = (): string =>
  `${(process.env.MOBILE_DEEP_LINK_SCHEME || 'repaircoin').trim()}://shop/payouts/callback`;

/**
 * The app-wide helmet CSP (script-src 'self') blocks these pages' inline scripts and the
 * Stripe CDN script, so the onboarding page would render its static spinner and never run
 * any JS. These pages are inert (no auth, no secrets, no user content), so dropping the
 * CSP here is safe; upgrade-insecure-requests also goes with it, which the http://localhost
 * dev origin needs.
 */
const sendInlineHtml = (res: Response, html: string): void => {
  res.removeHeader('Content-Security-Policy');
  res.type('html').send(html);
};

/**
 * GET /api/shops/connect/oauth/callback  (PUBLIC)
 * Stripe redirects the shop's browser here after they authorize. There's no app session on
 * this hop, so trust comes from the signed `state` minted in /connect/onboarding-link, not
 * from auth. We exchange the code, store the account id, then bounce back to the payouts page.
 */
publicRouter.get('/connect/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  // Route the shop back to whichever surface started the flow. state carries the platform
  // hint (see createOnboardingLink); resolvable even on the error/cancel path since Stripe
  // still echoes state back on denial, and independently of the completeOAuth() verify below.
  const platform = state ? getStripeConnectService().getOAuthStatePlatform(String(state)) : 'web';
  const returnTo =
    platform === 'mobile' ? mobileDeepLinkBase() : `${frontendBase()}/register/shop/payouts`;

  // Shop cancelled or Stripe denied the authorization.
  if (error || !code || !state) {
    return platform === 'popup'
      ? sendInlineHtml(res, popupCloser(false))
      : res.redirect(`${returnTo}?error=1`);
  }

  try {
    await getStripeConnectService().completeOAuth(String(code), String(state));
    return platform === 'popup'
      ? sendInlineHtml(res, popupCloser(true))
      : res.redirect(`${returnTo}?connected=1`);
  } catch (err) {
    logger.error('Stripe Connect OAuth callback failed', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    return platform === 'popup'
      ? sendInlineHtml(res, popupCloser(false))
      : res.redirect(`${returnTo}?error=1`);
  }
});

/**
 * GET /api/shops/connect/hosted/return  (PUBLIC)
 * Where Stripe's hosted (Account Link) onboarding sends the browser back. Two jobs:
 *
 *  - mode=refresh: the single-use Account Link expired or was already consumed. Re-mint a
 *    fresh one from the signed state and 302 straight back into Stripe — the shop never
 *    sees a dead end and the app isn't involved.
 *  - normal return: hand the shop back to whichever surface started the flow (deep link for
 *    mobile, the get-paid page for web). Reaching this URL does NOT mean onboarding
 *    finished — the client must trust a live GET /connect/status read, exactly like the
 *    OAuth callback's ?connected=1.
 *
 * Account Links reject custom schemes as return/refresh URLs, which is why mobile has to
 * bounce through here at all. No auth on this hop; the signed state is the only trust, and
 * only the refresh re-mint relies on it.
 */
publicRouter.get('/connect/hosted/return', async (req: Request, res: Response) => {
  const { state, mode } = req.query;

  const platform = state
    ? getStripeConnectService().getHostedStatePlatform(String(state))
    : 'web';
  const returnTo =
    platform === 'mobile' ? mobileDeepLinkBase() : `${frontendBase()}/shop/get-paid`;

  if (mode === 'refresh' && state) {
    try {
      const url = await getStripeConnectService().refreshHostedOnboardingLink(String(state));
      return res.redirect(url);
    } catch (err) {
      logger.error('Failed to refresh hosted onboarding link', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      return res.redirect(`${returnTo}?error=1`);
    }
  }

  return res.redirect(`${returnTo}?connected=1`);
});

/**
 * Terminal page for the popup flow: tell the opener how it went, then close. The shop never
 * leaves FixFlow — the app tab stayed mounted the whole time and just refreshes its status.
 *
 * targetOrigin is pinned to the frontend rather than '*' so the message can't be read by
 * whatever else might have opened this window.
 */
function popupCloser(connected: boolean): string {
  const origin = frontendBase();
  return `<!doctype html><meta charset="utf-8"><title>${
    connected ? 'Connected' : 'Not connected'
  }</title>
<body style="font-family:system-ui;background:#191919;color:#fff;display:grid;place-items:center;height:100vh;margin:0">
<p>${connected ? 'Stripe account connected. You can close this window.' : 'Connection cancelled.'}</p>
<script>
  try {
    window.opener && window.opener.postMessage(
      { source: 'fixflow-connect-oauth', connected: ${connected} },
      ${JSON.stringify(origin)}
    );
  } catch (e) {}
  setTimeout(function () { window.close(); }, 400);
</script>
</body>`;
}

router.use(authMiddleware);

/**
 * POST /api/shops/connect/onboarding-link
 * Returns the Stripe Connect OAuth authorize URL for the calling shop. The client redirects
 * to it; the shop signs into (or creates) their own Stripe account and authorizes us.
 */
router.post('/connect/onboarding-link', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop authentication required' });
    }

    const requested = req.body?.platform;
    const platform =
      requested === 'mobile' ? 'mobile' : requested === 'popup' ? 'popup' : 'web';
    const url = await getStripeConnectService().createOnboardingLink(shopId, platform);

    return res.json({ success: true, data: { url } });
  } catch (error) {
    logger.error('Failed to create Connect onboarding link', {
      shopId: req.user?.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to start Stripe onboarding'
    });
  }
});

/**
 * POST /api/shops/connect/account-session
 * Mints a short-lived Account Session client secret for the embedded "Get Paid" onboarding.
 * Creates the shop's Express connected account on first call. The client passes the secret to
 * @stripe/connect-js to render the onboarding component in-app — no redirect to Stripe.
 */
router.post('/connect/account-session', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop authentication required' });
    }

    const session = await getStripeConnectService().createAccountSession(shopId);

    return res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Failed to create Connect account session', {
      shopId: req.user?.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Refusing to replace a shop's own Stripe account is a deliberate 409, and the reason is
    // meant for the shop to read — don't flatten it into the generic 500 below.
    const status = (error as { status?: number })?.status;
    if (status === 409) {
      return res.status(409).json({
        success: false,
        error: error instanceof Error ? error.message : 'Payment onboarding is not available'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to start payment onboarding'
    });
  }
});

/**
 * POST /api/shops/connect/hosted-onboarding-link
 * Mints a Stripe-hosted onboarding link (Account Link) for the calling shop's Express
 * account — the counterpart of /connect/account-session for surfaces where the embedded
 * component can't run (Connect embedded components are unsupported in mobile WebViews).
 * The client opens the URL in a browser; Stripe returns via /connect/hosted/return.
 */
router.post('/connect/hosted-onboarding-link', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop authentication required' });
    }

    const platform = req.body?.platform === 'mobile' ? 'mobile' : 'web';
    const url = await getStripeConnectService().createHostedOnboardingLink(shopId, platform);

    return res.json({ success: true, data: { url } });
  } catch (error) {
    logger.error('Failed to create hosted onboarding link', {
      shopId: req.user?.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Refusing to replace a shop's own Stripe account is a deliberate 409, and the reason is
    // meant for the shop to read — don't flatten it into the generic 500 below.
    const status = (error as { status?: number })?.status;
    if (status === 409) {
      return res.status(409).json({
        success: false,
        error: error instanceof Error ? error.message : 'Payment onboarding is not available'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to start payment onboarding'
    });
  }
});

/**
 * GET /api/shops/connect/summary
 * Cheap, DB-only onboarding status for the dashboard payout-setup banner. Unlike
 * /connect/status this does NOT call Stripe, so it's safe to hit on every dashboard load.
 */
router.get('/connect/summary', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop authentication required' });
    }

    const summary = await getStripeConnectService().getOnboardingSummary(shopId);

    return res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Failed to read Connect summary', {
      shopId: req.user?.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to read payout setup status'
    });
  }
});

/**
 * GET /api/shops/connect/status
 * Live read of the shop's Connect state. The onboarding screen calls this on return from
 * Stripe rather than trusting the redirect, and rather than racing the account.updated webhook.
 */
router.get('/connect/status', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(401).json({ success: false, error: 'Shop authentication required' });
    }

    const status = await getStripeConnectService().getAccountStatus(shopId);

    return res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to read Connect status', {
      shopId: req.user?.shopId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to read Stripe connection status'
    });
  }
});

export default router;
export { publicRouter };
