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

/**
 * GET /api/shops/connect/oauth/callback  (PUBLIC)
 * Stripe redirects the shop's browser here after they authorize. There's no app session on
 * this hop, so trust comes from the signed `state` minted in /connect/onboarding-link, not
 * from auth. We exchange the code, store the account id, then bounce back to the payouts page.
 */
publicRouter.get('/connect/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const returnTo = `${frontendBase()}/register/shop/payouts`;

  // Shop cancelled or Stripe denied the authorization.
  if (error || !code || !state) {
    return res.redirect(`${returnTo}?error=1`);
  }

  try {
    await getStripeConnectService().completeOAuth(String(code), String(state));
    return res.redirect(`${returnTo}?connected=1`);
  } catch (err) {
    logger.error('Stripe Connect OAuth callback failed', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    return res.redirect(`${returnTo}?error=1`);
  }
});

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

    const url = await getStripeConnectService().createOnboardingLink(shopId);

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
