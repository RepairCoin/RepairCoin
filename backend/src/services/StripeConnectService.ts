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
  requirementsDue: string[];
  // Submitted and waiting on Stripe's review — NOT something the shop can act on.
  // Without these, "charges disabled" is indistinguishable from "you owe us data".
  pendingVerification: string[];
  disabledReason: string | null;
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
   * Build the Stripe Connect OAuth authorize URL. The shop clicks it and, on Stripe's page,
   * either signs into an existing Stripe account OR creates a new one, then authorizes us.
   * No account is created by the platform — Stripe returns the shop's own account id via the
   * callback.
   *
   * `state` is a short-lived signed token carrying the shopId, so the (public) callback can
   * trust which shop authorized without relying on a session cookie.
   */
  async createOnboardingLink(shopId: string): Promise<string> {
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      throw new Error('STRIPE_CONNECT_CLIENT_ID is not configured');
    }

    const shop = await shopRepository.getShop(shopId);
    if (!shop) {
      throw new Error(`Shop not found: ${shopId}`);
    }

    const state = jwt.sign(
      { shopId, purpose: 'connect_oauth' },
      process.env.JWT_SECRET as string,
      { expiresIn: '30m' }
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: connectRedirectUri(),
      state,
      // Prefill only — the shop can change these on Stripe's page.
      'stripe_user[email]': shop.email || '',
      'stripe_user[business_name]': shop.name || '',
    });

    return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
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

    await shopRepository.updateShop(shopId, {
      stripeConnectAccountId: connectedAccountId,
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
        pendingVerification: [],
        disabledReason: null,
      };
    }

    const account = await this.stripe.accounts.retrieve(shop.stripeConnectAccountId);
    const status: ConnectAccountStatus = {
      accountId: account.id,
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      detailsSubmitted: account.details_submitted === true,
      requirementsDue: account.requirements?.currently_due ?? [],
      pendingVerification: account.requirements?.pending_verification ?? [],
      disabledReason: account.requirements?.disabled_reason ?? null,
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
   * Resolve the shop behind an account.updated event. Prefers the metadata we set at
   * creation, falling back to the indexed column lookup.
   */
  async findShopIdByAccount(account: Stripe.Account): Promise<string | null> {
    const fromMetadata = account.metadata?.shopId;
    if (fromMetadata) return fromMetadata;

    const shop = await shopRepository.getShopByConnectAccountId(account.id);
    return shop?.shopId ?? null;
  }
}

let stripeConnectService: StripeConnectService | null = null;

export function getStripeConnectService(): StripeConnectService {
  if (!stripeConnectService) {
    stripeConnectService = new StripeConnectService();
  }
  return stripeConnectService;
}
