import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { getStripeService } from './StripeService';
import { shopRepository } from '../repositories';

/**
 * Stripe Connect (Standard, via OAuth).
 *
 * The shop connects its OWN Stripe account: it clicks Connect, and on Stripe's page it either
 * signs into an existing account OR creates a new one — then authorizes RepairCoin. Either
 * way it's the shop's own Standard account; RepairCoin does NOT manage their payouts — they
 * keep their own dashboard, payouts, disputes, and Stripe fees. Our only stake is the
 * per-booking commission, taken later as an `application_fee_amount` on the booking charge
 * (see the scope note below).
 *
 * Scope: linking only — OAuth authorize + token exchange. This service deliberately does NOT
 * yet touch `application_fee_amount` / `transfer_data`; commission routing on booking charges
 * is the next phase, gated on section 7 of
 * docs/tasks/strategy/pricing-alignment/payments-processing-connect-scope.md.
 *
 * Note the two Stripe ids for a shop are different things and must not be conflated:
 *   - stripe_customers.stripe_customer_id -> the shop as a PAYER (the monthly subscription)
 *   - shops.stripe_connect_account_id     -> the shop as a SELLER (acct_..., their own account)
 */
export interface ConnectAccountStatus {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];    // currently_due — needed now to reach the next threshold
  eventuallyDue: string[];      // will be required but not yet — i.e. "still to do", not "done"
  // Submitted and waiting on Stripe's review — NOT something the shop can act on.
  // Without these, "charges disabled" is indistinguishable from "you owe us data".
  pendingVerification: string[];
  disabledReason: string | null;
  /**
   * Positive confirmation for the steps Stripe does NOT reliably surface as requirements.
   *
   * A tax id and an identity document are frequently absent from `currently_due` and
   * `eventually_due` — Stripe asks for them only when it needs them — so "not outstanding"
   * cannot be read as "provided". These fields say what the account actually holds.
   */
  taxIdProvided: boolean;
  /** Stripe's own verification state for the representative: unverified | pending | verified. */
  identityVerification: 'unverified' | 'pending' | 'verified';
  /**
   * How the account is held, which decides who can edit it.
   *
   * 'express' — created by us; requirements are editable in-app via the embedded component.
   * 'standard' — the shop's own account, adopted through OAuth. Stripe issues no Account
   *   Session for it, so outstanding requirements can ONLY be resolved in the shop's own
   *   Stripe Dashboard. The UI must link out rather than offering an editor that can't work.
   */
  accountType: 'express' | 'standard' | null;
}

/**
 * Which surface started the OAuth flow, so the callback knows how to hand the shop back.
 * 'popup' is the web default: the app opens Stripe in a child window and stays mounted, so
 * the callback closes the window and messages the opener instead of redirecting anything.
 */
export type ConnectOAuthPlatform = 'web' | 'mobile' | 'popup';

/**
 * Is this an account the shop manages itself, or one we manage for them?
 *
 * `controller.stripe_dashboard.type` is the authoritative signal and is populated under both the
 * legacy type-based model and the controller-based one that replaces it:
 *   full    → the shop has its own Stripe dashboard (legacy "standard"). No Account Session.
 *   express → Stripe-hosted Express dashboard, platform-controlled. Embeddable.
 *   none    → no dashboard (legacy "custom"). Platform-controlled, embeddable.
 * `type` is the fallback for anything that predates the controller field.
 */
function accountTypeFrom(account: Stripe.Account): 'express' | 'standard' {
  const dashboard = account.controller?.stripe_dashboard?.type;
  if (dashboard === 'full') return 'standard';
  if (dashboard === 'express' || dashboard === 'none') return 'express';
  return account.type === 'standard' ? 'standard' : 'express';
}

export interface ConnectOnboardingSummary {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

// Where Stripe redirects the browser after OAuth. MUST exactly match a redirect URI
// registered in the platform's Connect settings. Resolves per environment:
//   1. STRIPE_CONNECT_REDIRECT_URI  — explicit override, if ever needed
//   2. API_BASE_URL                 — the backend's public base (already set in deploy, e.g.
//                                     https://api.repaircoin.ai), same var the ads webhooks use
//   3. http://localhost:4000        — local-dev fallback
const connectRedirectUri = (): string => {
  const explicit = process.env.STRIPE_CONNECT_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = (process.env.API_BASE_URL || 'http://localhost:4000').trim().replace(/\/$/, '');
  return `${base}/api/shops/connect/oauth/callback`;
};

export class StripeConnectService {
  private get stripe(): Stripe {
    return getStripeService().getStripe();
  }

  /**
   * Build the Stripe Connect OAuth authorize URL for a shop that ALREADY HAS a Stripe account.
   * They sign in on Stripe's page and authorize us; Stripe returns their own account id via the
   * callback and the platform creates nothing.
   *
   * This path exists only to adopt existing accounts. Shops without one go through embedded
   * Express onboarding (createAccountSession) instead, which keeps them inside FixFlow — so the
   * URL lands on Stripe's sign-in form (`stripe_landing=login`) rather than its sign-up form,
   * and carries no sign-up prefill.
   *
   * `state` is a short-lived signed token carrying the shopId, so the (public) callback can
   * trust which shop authorized without relying on a session cookie. `platform` rides along
   * in the same token so the callback knows whether to hand the shop back to the web app or
   * deep-link back into the mobile app — see the callback route for the redirect branch.
   */
  async createOnboardingLink(
    shopId: string,
    platform: ConnectOAuthPlatform = 'web'
  ): Promise<string> {
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      throw new Error('STRIPE_CONNECT_CLIENT_ID is not configured');
    }

    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${shopId}`);
    }

    const state = jwt.sign(
      { shopId, purpose: 'connect_oauth', platform },
      process.env.JWT_SECRET as string,
      { expiresIn: '30m' }
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: connectRedirectUri(),
      state,
      // Land on sign-in, not sign-up: this flow is for connecting an account the shop already
      // owns. Stripe still exposes a sign-up link on that page — it can't be disabled through
      // OAuth params — so this is the strongest steer available, not a hard block.
      stripe_landing: 'login',
      // Force the account chooser even when the browser is already signed into Stripe, so a
      // shop with several accounts picks the right one instead of silently linking the last used.
      always_prompt: 'true',
    });

    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Read the `platform` a `state` token was minted for, without touching account linking.
   * Used by the (public) OAuth callback to decide whether to hand the shop back to the web
   * app or deep-link into mobile — kept independent of completeOAuth's own verify below so
   * this stays a pure, side-effect-free read even if that verification logic changes.
   * Defaults to 'web' on any decode failure (expired/malformed/legacy pre-platform tokens),
   * since 'web' is the redirect this app has always used.
   */
  getOAuthStatePlatform(state: string): ConnectOAuthPlatform {
    try {
      const payload = jwt.verify(state, process.env.JWT_SECRET as string) as {
        platform?: string;
      };
      if (payload.platform === 'mobile') return 'mobile';
      if (payload.platform === 'popup') return 'popup';
      return 'web';
    } catch {
      return 'web';
    }
  }

  /**
   * Exchange the OAuth `code` for the shop's connected account id and persist it. Verifies the
   * signed `state` to recover which shop authorized. Returns the shopId (for the redirect).
   */
  async completeOAuth(code: string, state: string): Promise<string> {
    let shopId: string;
    try {
      const payload = jwt.verify(state, process.env.JWT_SECRET as string) as {
        shopId?: string;
        purpose?: string;
      };
      if (payload.purpose !== 'connect_oauth' || !payload.shopId) {
        throw new Error('bad state payload');
      }
      shopId = payload.shopId;
    } catch {
      throw new Error('Invalid or expired OAuth state');
    }

    const token = await this.stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const connectedAccountId = token.stripe_user_id;
    if (!connectedAccountId) {
      throw new Error('Stripe did not return a connected account id');
    }

    // Sharing one Stripe account across several shops under the same owner is allowed; the
    // account.updated handler fans out to every shop on the account so none is left stale.
    //
    // Record the account TYPE, not just the id. OAuth yields a Standard account the shop owns;
    // without this the column keeps whatever it was — NULL, or a stale 'express' from an earlier
    // embedded attempt, which would send getOrCreateExpressAccount and accountSessions.create
    // down paths that only work for Express accounts.
    await shopRepository.updateShop(shopId, {
      stripeConnectAccountId: connectedAccountId,
      connectAccountType: 'standard',
      // The mirror flags describe the account being replaced, so they are wrong the moment the
      // id changes. Clearing them here means a failure of the status read below leaves the shop
      // reading as "not ready" instead of inheriting the previous account's charges_enabled —
      // the same reset getOrCreateExpressAccount performs, for the same reason.
      connectChargesEnabled: false,
      connectPayoutsEnabled: false,
    });

    // Sync charges/payouts immediately — an existing active account is already enabled, so the
    // banner/guard flip right away without waiting for the account.updated webhook.
    try {
      const account = await this.stripe.accounts.retrieve(connectedAccountId);
      await this.syncAccountState(
        shopId,
        account.charges_enabled === true,
        account.payouts_enabled === true
      );
    } catch (error) {
      logger.warn('Connected account retrieve after OAuth failed; status will sync later', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info('Stripe Connect account linked via OAuth', { shopId, connectedAccountId });
    return shopId;
  }

  /**
   * Live read of the account's state from Stripe.
   *
   * The webhook is the primary path for keeping our columns fresh; this exists so the
   * return-from-Stripe screen doesn't have to race it.
   */
  async getAccountStatus(shopId: string): Promise<ConnectAccountStatus> {
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${shopId}`);
    }

    if (!shop.stripeConnectAccountId) {
      return {
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        requirementsDue: [],
        eventuallyDue: [],
        pendingVerification: [],
        disabledReason: null,
        taxIdProvided: false,
        identityVerification: 'unverified',
        accountType: null,
      };
    }

    const account = await this.stripe.accounts.retrieve(shop.stripeConnectAccountId);

    // Either shape can carry the tax identifier depending on how the shop registered:
    // a company files under an EIN/tax id, a sole trader under a personal id number.
    const taxIdProvided =
      account.company?.tax_id_provided === true ||
      account.individual?.id_number_provided === true;

    const verificationStatus = account.individual?.verification?.status;

    const status: ConnectAccountStatus = {
      accountId: account.id,
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      detailsSubmitted: account.details_submitted === true,
      requirementsDue: account.requirements?.currently_due ?? [],
      eventuallyDue: account.requirements?.eventually_due ?? [],
      pendingVerification: account.requirements?.pending_verification ?? [],
      disabledReason: account.requirements?.disabled_reason ?? null,
      taxIdProvided,
      identityVerification:
        verificationStatus === 'verified'
          ? 'verified'
          : verificationStatus === 'pending'
          ? 'pending'
          : 'unverified',
      // Trust Stripe's own view of the account over our mirror column, which is NULL for
      // everything linked before the type was recorded.
      //
      // Read the dashboard controller first, not `type`. What we actually need to know is who
      // manages the account: `full` means the shop has its own Stripe dashboard, so we can't
      // mint an Account Session and the UI must link out. `type` can't answer that on its own —
      // verified against the API: an account created with controller properties (the model that
      // replaces express/standard/custom) comes back as type `none` with the controller set, so
      // keying on `type` alone would classify it as Express and hide the link-out branch.
      accountType: accountTypeFrom(account),
    };

    await this.syncAccountState(shopId, status.chargesEnabled, status.payoutsEnabled);
    return status;
  }

  /**
   * Cheap, DB-only read of onboarding progress — no Stripe call. Backs the dashboard
   * payout-setup banner, which renders on every load and must not fan out to Stripe.
   * The account.updated webhook (and the return-from-Stripe status check) keep these
   * columns fresh.
   */
  async getOnboardingSummary(shopId: string): Promise<ConnectOnboardingSummary> {
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${shopId}`);
    }

    return {
      hasAccount: !!shop.stripeConnectAccountId,
      chargesEnabled: shop.connectChargesEnabled === true,
      payoutsEnabled: shop.connectPayoutsEnabled === true,
    };
  }

  /**
   * Persist Stripe's view of the account. Called from both getAccountStatus and the
   * account.updated webhook. `connect_onboarded_at` is stamped once, the first time
   * charges go live.
   */
  async syncAccountState(
    shopId: string,
    chargesEnabled: boolean,
    payoutsEnabled: boolean
  ): Promise<void> {
    const shop = await shopRepository.getShop(shopId);
    const firstTimeEnabled = chargesEnabled && !shop?.connectOnboardedAt;

    await shopRepository.updateShop(shopId, {
      connectChargesEnabled: chargesEnabled,
      connectPayoutsEnabled: payoutsEnabled,
      ...(firstTimeEnabled ? { connectOnboardedAt: new Date().toISOString() } : {}),
    });

    if (firstTimeEnabled) {
      logger.info('Stripe Connect onboarding completed', { shopId });
    }
  }

  /**
   * Get the shop's Express connected account, creating one if it doesn't have an Express
   * account yet. The embedded "Get Paid" onboarding uses Express accounts (created by the
   * platform via the API), NOT the legacy Standard/OAuth account. A shop migrating off a
   * Standard account gets a brand-new Express account — we never deauthorize the old Standard
   * account (that is irreversible and bricks it), we just repoint stripe_connect_account_id
   * once the Express account exists.
   */
  async getOrCreateExpressAccount(
    shopId: string,
    options: { migrateFromStandard?: boolean } = {}
  ): Promise<string> {
    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${shopId}`);
    }

    // Reuse only if we've already created an Express account for this shop.
    if (shop.stripeConnectAccountId && shop.connectAccountType === 'express') {
      return shop.stripeConnectAccountId;
    }

    // A Standard account is the shop's own, and it is where their money is currently landing.
    // Creating an Express account repoints us away from it: the old account keeps taking
    // payments while FixFlow stops referencing it. The UI hides this path for Standard accounts,
    // but that guard is bypassed by a direct API call and by a failed status read — which is
    // indistinguishable from a shop that has no account at all. Refuse unless a caller asks for
    // the migration explicitly.
    if (
      shop.stripeConnectAccountId &&
      shop.connectAccountType === 'standard' &&
      !options.migrateFromStandard
    ) {
      throw Object.assign(
        new Error(
          'This shop is connected to its own Stripe account. Manage it in the Stripe Dashboard, ' +
            'or disconnect it before setting up FixFlow-managed payments.'
        ),
        { status: 409 }
      );
    }

    const account = await this.stripe.accounts.create({
      type: 'express',
      email: shop.email || undefined,
      business_profile: {
        name: shop.name || undefined,
      },
      // Request the capabilities needed to take card payments via direct charges on the
      // connected account (with the platform application fee). Without these, Stripe rejects
      // charges with "card_payments capability not enabled". They activate once the shop
      // finishes onboarding (charges_enabled flips true via the account.updated webhook).
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { shopId },
    });

    await shopRepository.updateShop(shopId, {
      stripeConnectAccountId: account.id,
      connectAccountType: 'express',
      // A fresh account isn't enabled yet — reset the mirror flags so guards/banners stay honest
      // until the account.updated webhook (or a live status read) confirms charges are live.
      connectChargesEnabled: false,
      connectPayoutsEnabled: false,
    });

    logger.info('Created Stripe Connect Express account', { shopId, accountId: account.id });
    return account.id;
  }

  /**
   * Mint an Account Session for the embedded "Get Paid" onboarding component. The returned
   * client secret is short-lived and scoped to this account; the frontend hands it to
   * @stripe/connect-js to render <ConnectAccountOnboarding> in-app — no redirect to Stripe.
   */
  async createAccountSession(
    shopId: string
  ): Promise<{ clientSecret: string; accountId: string }> {
    const accountId = await this.getOrCreateExpressAccount(shopId);

    const session = await this.stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    // Typed as nullable. Failing here gives the client a real error instead of a secret-shaped
    // null that only surfaces as an opaque Connect initialisation failure in the browser.
    if (!session.client_secret) {
      throw new Error('Stripe returned an Account Session without a client secret');
    }

    return { clientSecret: session.client_secret, accountId };
  }

  /**
   * Resolve the shop behind an account.updated event. Prefers the metadata we set at
   * creation, falling back to the indexed column lookup.
   */
  async findShopIdsByAccount(account: Stripe.Account): Promise<string[]> {
    // The column is authoritative — it says which account each shop is actually using — and
    // several shops may share one account, so this is the full set, not the first match.
    const shopIds = await shopRepository.getShopIdsByConnectAccountId(account.id);

    // metadata.shopId is stamped when we create an Express account and never cleared, so it
    // outlives the link: an account the shop abandoned still names them. It is only a hint, and
    // only a valid one while the shop still points at this account — which the column lookup
    // above already establishes. Trusting it on its own is how a dead account's account.updated
    // overwrites the live account's charges/payouts flags and silently switches payments off.
    const fromMetadata = account.metadata?.shopId;
    if (fromMetadata && !shopIds.includes(fromMetadata)) {
      logger.info('Ignoring account.updated metadata for a shop that has moved accounts', {
        accountId: account.id,
        claimedShopId: fromMetadata,
      });
    }

    return shopIds;
  }
}

let stripeConnectService: StripeConnectService | null = null;

export function getStripeConnectService(): StripeConnectService {
  if (!stripeConnectService) {
    stripeConnectService = new StripeConnectService();
  }
  return stripeConnectService;
}
