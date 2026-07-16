import { agencyRepository, adminRepository, shopRepository } from '../../../repositories';
import { Agency, AgencyClientShop, AgencyStatus, AgencyInvite } from '../../../repositories/AgencyRepository';
import { shopManagementService } from '../../admin/services/management/ShopManagementService';
import { getSubscriptionService } from '../../../services/SubscriptionService';
import { getStripeService } from '../../../services/StripeService';
import { DatabaseService } from '../../../services/DatabaseService';
import { resolveAgencyBasePriceId, getAgencyExtraClientPriceId } from '../../../config/subscriptionPlans';
import { logger } from '../../../utils/logger';

export interface ProvisionAgencyInput {
  ownerShopId: string;
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  accountManagerAddress?: string | null;
  clientLimit?: number;
  perClientPriceCents?: number;
}

export interface CreateClientInput {
  shopId: string;
  name: string;
  walletAddress: string;
  email?: string;
  phone?: string;
  address?: string;
  location?:
    | string
    | { lat?: number; lng?: number; city?: string; state?: string; zipCode?: string };
}

export interface AgencyManagerContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface AgencyProfile {
  agency: Agency;
  activeClientCount: number;
  clientLimit: number;
  accountManager: AgencyManagerContact | null;
}

export class AgencyService {
  /**
   * Create the agency owned by a shop (the shop that activated the Agency Program add-on).
   * Used by self-serve activation and the admin backdoor. One agency per shop.
   */
  async provisionAgency(input: ProvisionAgencyInput): Promise<Agency> {
    if (!input.ownerShopId) {
      throw new Error('Owner shop is required');
    }
    if (!input.name || !input.name.trim()) {
      throw new Error('Agency name is required');
    }
    if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
      throw new Error('Please enter a valid contact email');
    }

    const ownerShop = await shopRepository.getShop(input.ownerShopId);
    if (!ownerShop) {
      throw new Error('Owner shop not found');
    }
    const existing = await agencyRepository.getAgencyByOwnerShop(input.ownerShopId);
    if (existing) {
      throw new Error('This shop already has an agency');
    }
    if (input.accountManagerAddress) {
      const manager = await adminRepository.getAdmin(input.accountManagerAddress);
      if (!manager || manager.isActive === false) {
        throw new Error('Account manager must be an active admin');
      }
    }

    return agencyRepository.createAgency({
      name: input.name,
      ownerShopId: input.ownerShopId,
      contactEmail: input.contactEmail ?? ownerShop.email ?? null,
      contactPhone: input.contactPhone ?? null,
      accountManagerAddress: input.accountManagerAddress ?? null,
      clientLimit: input.clientLimit,
      perClientPriceCents: input.perClientPriceCents,
    });
  }

  async listAgencies(): Promise<Agency[]> {
    return agencyRepository.listAgencies();
  }

  /** The agency owned by a shop, or null if the shop hasn't activated the add-on. */
  async getAgencyForShop(ownerShopId: string): Promise<Agency | null> {
    return agencyRepository.getAgencyByOwnerShop(ownerShopId);
  }

  /** Resolve the agency owned by a shop, throwing if the shop has no agency. */
  private async requireAgencyForShop(ownerShopId: string): Promise<Agency> {
    const agency = await agencyRepository.getAgencyByOwnerShop(ownerShopId);
    if (!agency) {
      throw new Error('This shop does not have an active agency');
    }
    return agency;
  }

  /** The owning shop's agency profile: account + client usage + AM contact. */
  async getAgencyProfileForShop(ownerShopId: string): Promise<AgencyProfile> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    const activeClientCount = await agencyRepository.getActiveClientCount(agency.id);

    let accountManager: AgencyManagerContact | null = null;
    if (agency.accountManagerAddress) {
      try {
        const admin = await adminRepository.getAdmin(agency.accountManagerAddress);
        if (admin && admin.isActive !== false) {
          accountManager = {
            name: admin.name ?? null,
            email: admin.email ?? null,
            phone: admin.phone ?? null,
          };
        }
      } catch (error) {
        logger.warn('Failed to load agency account manager', { agencyId: agency.id });
      }
    }

    return { agency, activeClientCount, clientLimit: agency.clientLimit, accountManager };
  }

  async listClientsForShop(ownerShopId: string): Promise<AgencyClientShop[]> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    return agencyRepository.listClients(agency.id);
  }

  /**
   * Create a new client shop under the owning shop's agency. The client is auto-active and linked
   * to the agency, which entitles it to Growth-tier features with no subscription of its own.
   * Client limit is soft (meter-and-allow beyond it, then bill for the overage — see
   * reconcileClientBilling).
   */
  async createClientForShop(ownerShopId: string, input: CreateClientInput): Promise<{ shopId: string; name: string }> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    if (!input.shopId || !input.name || !input.walletAddress) {
      throw new Error('shopId, name, and walletAddress are required');
    }
    if (input.shopId === ownerShopId) {
      throw new Error('An agency cannot add its own shop as a client');
    }

    await shopManagementService.createShop({
      shopId: input.shopId,
      name: input.name,
      walletAddress: input.walletAddress,
      email: input.email,
      phone: input.phone,
      address: input.address,
      verified: true,
      active: true,
      location: input.location,
    });

    await agencyRepository.addClient(agency.id, input.shopId);
    logger.info('Agency client created', { agencyId: agency.id, shopId: input.shopId });
    await this.reconcileClientBilling(agency).catch((error) =>
      logger.error('Agency client billing sync failed (add)', {
        agencyId: agency.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
    return { shopId: input.shopId, name: input.name };
  }

  /**
   * Unlink a client shop from the owning shop's agency. Clearing the link de-entitles the client
   * (it loses the agency's Growth entitlement + subscription bypass), so it reverts to needing its
   * own subscription to keep operating — no hard suspension required.
   */
  async removeClientForShop(ownerShopId: string, clientShopId: string): Promise<void> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    const isClient = await agencyRepository.isClientOfAgency(agency.id, clientShopId);
    if (!isClient) {
      throw new Error('Shop is not a client of this agency');
    }
    await agencyRepository.removeClient(agency.id, clientShopId);
    logger.info('Agency client removed', { agencyId: agency.id, shopId: clientShopId });
    await this.reconcileClientBilling(agency).catch((error) =>
      logger.error('Agency client billing sync failed (remove)', {
        agencyId: agency.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
  }

  /**
   * Reconcile the agency's metered per-client billing: the extra-client line item on the agency's
   * Stripe subscription carries quantity max(0, activeClients - clientLimit) at $50/client. Called
   * after every client add/remove. Best-effort at the call site so a Stripe hiccup never blocks
   * client management (soft limit — clients go live immediately; billing catches up).
   */
  async reconcileClientBilling(agency: Agency): Promise<void> {
    if (!agency.stripeSubscriptionId) return;
    const priceId = getAgencyExtraClientPriceId();
    if (!priceId) {
      logger.warn('STRIPE_PRICE_AGENCY_EXTRA_CLIENT not set — skipping agency client metering', {
        agencyId: agency.id,
      });
      return;
    }

    const activeClients = await agencyRepository.getActiveClientCount(agency.id);
    const desiredQty = Math.max(0, activeClients - agency.clientLimit);

    const stripe = getStripeService().getStripe();
    const subscription = await stripe.subscriptions.retrieve(agency.stripeSubscriptionId);
    const existingItem = subscription.items.data.find((item) => item.price.id === priceId);

    if (desiredQty === 0) {
      if (existingItem) {
        await stripe.subscriptionItems.del(existingItem.id, { proration_behavior: 'create_prorations' });
        logger.info('Agency extra-client billing item removed', { agencyId: agency.id });
      }
      return;
    }

    if (existingItem) {
      if (existingItem.quantity !== desiredQty) {
        await stripe.subscriptionItems.update(existingItem.id, {
          quantity: desiredQty,
          proration_behavior: 'create_prorations',
        });
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: agency.stripeSubscriptionId,
        price: priceId,
        quantity: desiredQty,
        proration_behavior: 'create_prorations',
      });
    }

    logger.info('Agency extra-client billing synced', {
      agencyId: agency.id,
      activeClients,
      clientLimit: agency.clientLimit,
      desiredQty,
    });
  }

  /** Whether a shop is a client of the owning shop's agency (used by the act-as-client guard). */
  async ownerCanActAsClient(ownerShopId: string, clientShopId: string): Promise<boolean> {
    const agency = await agencyRepository.getAgencyByOwnerShop(ownerShopId);
    if (!agency) return false;
    return agencyRepository.isClientOfAgency(agency.id, clientShopId);
  }

  private inviteUrl(token: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return `${frontendUrl}/register/shop?agency_invite=${token}`;
  }

  /** Mint a client invite link for the owning shop's agency. The client completes the standard
   *  shop signup with their own wallet; on success the new shop links to this agency. */
  async createInvite(ownerShopId: string, label?: string | null): Promise<AgencyInvite & { url: string }> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    const invite = await agencyRepository.createInvite(agency.id, label);
    logger.info('Agency invite created', { agencyId: agency.id, token: invite.token });
    return { ...invite, url: this.inviteUrl(invite.token) };
  }

  async listPendingInvites(ownerShopId: string): Promise<Array<AgencyInvite & { url: string }>> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    const invites = await agencyRepository.listPendingInvites(agency.id);
    return invites.map((inv) => ({ ...inv, url: this.inviteUrl(inv.token) }));
  }

  async revokeInvite(ownerShopId: string, token: string): Promise<void> {
    const agency = await this.requireAgencyForShop(ownerShopId);
    const revoked = await agencyRepository.revokeInvite(agency.id, token);
    if (!revoked) {
      throw new Error('Invite not found or already used');
    }
  }

  /** Public: validate an invite token for the signup page banner. */
  async getInviteInfo(token: string): Promise<{ valid: boolean; agencyName?: string }> {
    const invite = await agencyRepository.getInvite(token);
    if (!invite || invite.status !== 'pending') return { valid: false };
    const agency = await agencyRepository.getAgency(invite.agencyId);
    if (!agency || agency.status === 'cancelled') return { valid: false };
    return { valid: true, agencyName: agency.name };
  }

  /** Consume an invite at the end of standard shop registration: link the freshly-created shop to
   *  the inviting agency. Best-effort — never throws into the registration flow. */
  async acceptInvite(token: string, shopId: string): Promise<{ linked: boolean }> {
    const invite = await agencyRepository.getInvite(token);
    if (!invite || invite.status !== 'pending') return { linked: false };
    const agency = await agencyRepository.getAgency(invite.agencyId);
    if (!agency || agency.status === 'cancelled') return { linked: false };

    await agencyRepository.addClient(agency.id, shopId);
    await agencyRepository.acceptInvite(token, shopId);
    logger.info('Agency invite accepted', { agencyId: agency.id, shopId, token });

    await this.reconcileClientBilling(agency).catch((error) =>
      logger.error('Agency client billing sync failed (invite accept)', {
        agencyId: agency.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
    return { linked: true };
  }

  /**
   * Begin self-serve Agency Program activation: create a Stripe Checkout session for the
   * $999/mo base plan. The `agencies` row is NOT created here — it's provisioned (status=active)
   * only when the checkout.session.completed webhook fires, so an abandoned checkout leaves no
   * orphan agency. The owner shop's existing Stripe customer is reused (same billing entity),
   * and the intended agency name rides along in the session metadata for the webhook.
   */
  async createActivationCheckoutSession(
    ownerShopId: string,
    input: { billingEmail?: string; billingContact?: string; name?: string }
  ): Promise<{ paymentUrl: string; sessionId: string }> {
    const existing = await agencyRepository.getAgencyByOwnerShop(ownerShopId);
    if (existing && existing.status === 'active') {
      throw new Error('This shop already has an active agency');
    }
    const shop = await shopRepository.getShop(ownerShopId);
    if (!shop) {
      throw new Error('Owner shop not found');
    }

    const billingEmail = input.billingEmail?.trim() || shop.email || undefined;
    const billingContact = input.billingContact?.trim() || shop.name || undefined;
    if (!billingEmail) {
      throw new Error('A billing email is required to activate the Agency Program');
    }

    const subscriptionService = getSubscriptionService();
    const stripeService = getStripeService();

    // Reuse (or lazily create) the owner shop's Stripe customer.
    let stripeCustomerId = (await subscriptionService.getCustomerByShopId(ownerShopId))?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer({
        email: billingEmail,
        name: billingContact,
        shopId: ownerShopId,
      });
      stripeCustomerId = customer.id;
      await DatabaseService.getInstance()
        .getPool()
        .query(
          `INSERT INTO stripe_customers (shop_id, stripe_customer_id, email, name)
           VALUES ($1, $2, $3, $4)`,
          [ownerShopId, customer.id, billingEmail, billingContact ?? null]
        );
    }

    const agencyName = input.name?.trim() || shop.name || 'My Agency';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    // Same metadata on the session AND the subscription: the session drives checkout.completed
    // provisioning; the subscription copy lets subscription.updated/deleted be recognized as
    // agency events even before the agency row exists.
    const metadata = {
      type: 'agency_activation',
      shopId: ownerShopId,
      agencyName,
      environment: process.env.NODE_ENV || 'development',
    };

    const stripe = stripeService.getStripe();
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: resolveAgencyBasePriceId(), quantity: 1 }],
      mode: 'subscription',
      success_url: `${frontendUrl}/shop?tab=agency`,
      cancel_url: `${frontendUrl}/shop?tab=plans`,
      metadata,
      subscription_data: { metadata },
    });

    logger.info('Agency activation checkout session created', { ownerShopId, sessionId: session.id });
    return { paymentUrl: session.url ?? '', sessionId: session.id };
  }

  /**
   * Provision/activate the agency for a shop from a completed Stripe checkout (called by the
   * checkout.session.completed webhook once payment succeeds).
   */
  async activateFromCheckout(input: {
    ownerShopId: string;
    name: string;
    contactEmail?: string | null;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }): Promise<Agency> {
    const agency = await agencyRepository.activateFromCheckout(input);
    logger.info('Agency activated from checkout', {
      agencyId: agency.id,
      ownerShopId: input.ownerShopId,
    });
    return agency;
  }

  /**
   * Sync an agency's status from a Stripe subscription lifecycle event. Safe to call for every
   * subscription webhook — it only touches a row whose stripe_subscription_id matches, so shop
   * plan subscriptions pass through untouched.
   */
  async syncSubscriptionStatus(stripeSubscriptionId: string, stripeStatus: string): Promise<void> {
    let status: AgencyStatus | null = null;
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        status = 'active';
        break;
      case 'past_due':
      case 'unpaid':
        status = 'past_due';
        break;
      case 'canceled':
      case 'incomplete_expired':
        status = 'cancelled';
        break;
      default:
        status = null; // incomplete / paused — leave the agency status as-is
    }
    if (!status) return;
    const agencyId = await agencyRepository.updateStatusByStripeSubscriptionId(
      stripeSubscriptionId,
      status
    );
    if (agencyId) {
      logger.info('Agency subscription status synced', { agencyId, stripeStatus, status });
      // Cascade coverage to client shops: a cancelled agency de-qualifies its clients; an
      // active/past_due one keeps them operational.
      const clientStatus = status === 'cancelled' ? 'not_qualified' : 'subscription_qualified';
      await agencyRepository
        .setActiveClientsOperationalStatus(agencyId, clientStatus)
        .catch((error) =>
          logger.error('Agency client operational_status cascade failed', {
            agencyId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );
    }
  }
}

export const agencyService = new AgencyService();
