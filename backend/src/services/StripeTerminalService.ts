import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { getStripeService } from './StripeService';
import { getStripeConnectService } from './StripeConnectService';
import {
  shopRepository,
  shopLocationRepository,
  shopTerminalRepository,
} from '../repositories';
import type { TerminalLocation, TerminalReader } from '../repositories/ShopTerminalRepository';

/**
 * Stripe Terminal for shops. Locations and readers are objects on the SHOP'S connected account,
 * reached with the platform key plus the Stripe-Account header — identical for Standard and
 * Express. Terminal transacts under `card_payments`, the capability Connect onboarding already
 * requests; `card_present` is a PaymentIntent payment_method_type, not a capability.
 */

const TEST_PAYMENT_AMOUNT_CENTS = 100;

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export class StripeTerminalService {
  private get stripe(): Stripe {
    return getStripeService().getStripe();
  }

  /**
   * The connected account to address, having confirmed it can actually transact. Callers get a
   * 409 they can show the shop rather than an opaque Stripe error at reader-registration time.
   */
  private async requireAccountId(shopId: string): Promise<string> {
    const shop = await shopRepository.getShop(shopId);
    if (!shop) throw httpError(`Shop not found: ${shopId}`, 404);
    if (!shop.stripeConnectAccountId) {
      throw httpError('Connect a Stripe account before setting up a card reader.', 409);
    }
    if (!shop.connectChargesEnabled) {
      throw httpError(
        'This Stripe account cannot take payments yet. Finish payment setup, then add a reader.',
        409
      );
    }
    return shop.stripeConnectAccountId;
  }

  /**
   * Two-letter ISO country for the Stripe address. The shops column is free text, so anything
   * that isn't already a country code falls back to US rather than failing the Location create.
   */
  private countryCode(raw?: string | null): string {
    const trimmed = (raw ?? '').trim();
    return /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : 'US';
  }

  /**
   * The Stripe Location for a shop location, created on first use. Terminal requires every
   * reader to sit under one, so this runs before any reader registration — including for shops
   * on tiers without multi-location, which get one derived from their primary location.
   */
  async ensureLocation(shopId: string, locationId?: string): Promise<TerminalLocation> {
    const stripeAccountId = await this.requireAccountId(shopId);

    const location = locationId
      ? await shopLocationRepository.getById(locationId)
      : await shopLocationRepository.getPrimary(shopId);

    if (!location || location.shopId !== shopId) {
      throw httpError('No shop location to attach a reader to.', 404);
    }

    const existing = await shopTerminalRepository.findLocation(
      shopId,
      location.id,
      stripeAccountId
    );
    if (existing) return existing;

    const shop = await shopRepository.getShop(shopId);
    const country = this.countryCode(shop?.country);

    // Fall back to the shop's own address: a branch row often carries only a name, and Stripe
    // rejects a Location missing any field its country requires.
    const line1 = location.address || shop?.address || '';
    const city = location.city || shop?.city || '';
    const state = location.state || shop?.locationState || '';
    const postalCode = location.zipCode || shop?.locationZipCode || '';

    const missing: string[] = [];
    if (!line1) missing.push('street address');
    if (country === 'US') {
      if (!city) missing.push('city');
      if (!state) missing.push('state');
      if (!postalCode) missing.push('ZIP code');
    }
    if (missing.length > 0) {
      throw httpError(
        `Stripe needs a full address for this reader's location. Add your ${missing.join(
          ', '
        )} in shop settings, then pair the reader.`,
        400
      );
    }

    const stripeLocation = await this.stripe.terminal.locations.create(
      {
        display_name: location.name || shop?.name || 'Store',
        address: {
          line1,
          city: city || undefined,
          state: state || undefined,
          postal_code: postalCode || undefined,
          country,
        },
        metadata: { shopId, locationId: location.id },
      },
      { stripeAccount: stripeAccountId }
    );

    logger.info('Created Stripe Terminal location', {
      shopId,
      locationId: location.id,
      stripeLocationId: stripeLocation.id,
    });

    return shopTerminalRepository.createLocation({
      shopId,
      locationId: location.id,
      stripeAccountId,
      stripeLocationId: stripeLocation.id,
      displayName: stripeLocation.display_name ?? null,
    });
  }

  async listLocations(shopId: string): Promise<TerminalLocation[]> {
    const stripeAccountId = await this.requireAccountId(shopId);
    return shopTerminalRepository.listLocations(shopId, stripeAccountId);
  }

  /**
   * Readers with their status refreshed from Stripe. Status is advisory — Stripe does not push
   * reader presence and its own SDK warns against gating payments on it — so a reader Stripe no
   * longer knows about is reported offline rather than dropped.
   */
  async listReaders(shopId: string): Promise<TerminalReader[]> {
    const stripeAccountId = await this.requireAccountId(shopId);
    const readers = await shopTerminalRepository.listReaders(shopId, stripeAccountId);

    await Promise.all(
      readers.map(async (reader) => {
        try {
          const live = await this.stripe.terminal.readers.retrieve(reader.stripeReaderId, {
            stripeAccount: stripeAccountId,
          });
          const status = 'status' in live ? live.status ?? null : null;
          reader.status = status;
          await shopTerminalRepository.updateReaderStatus(reader.id, status);
        } catch (error) {
          logger.warn('Failed to refresh Terminal reader status', {
            shopId,
            readerId: reader.stripeReaderId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          reader.status = 'offline';
        }
      })
    );

    return readers;
  }

  async registerReader(
    shopId: string,
    input: { registrationCode: string; label?: string; locationId?: string }
  ): Promise<TerminalReader> {
    const stripeAccountId = await this.requireAccountId(shopId);
    const terminalLocation = await this.ensureLocation(shopId, input.locationId);

    const reader = await this.stripe.terminal.readers.create(
      {
        registration_code: input.registrationCode,
        location: terminalLocation.stripeLocationId,
        label: input.label || undefined,
        metadata: { shopId },
      },
      { stripeAccount: stripeAccountId }
    );

    logger.info('Registered Stripe Terminal reader', {
      shopId,
      readerId: reader.id,
      locationId: terminalLocation.locationId,
    });

    return shopTerminalRepository.createReader({
      shopId,
      terminalLocationId: terminalLocation.id,
      stripeAccountId,
      stripeReaderId: reader.id,
      label: reader.label ?? null,
      deviceType: reader.device_type ?? null,
      serialNumber: reader.serial_number ?? null,
      status: reader.status ?? null,
    });
  }

  async setDefaultReader(shopId: string, readerId: string): Promise<TerminalReader> {
    const reader = await shopTerminalRepository.setDefaultReader(readerId, shopId);
    if (!reader) throw httpError('Reader not found.', 404);
    return reader;
  }

  /**
   * Deleting on Stripe first would strand the row if the local delete then failed; doing it in
   * this order means the worst case is an orphaned Stripe reader, which re-registering reclaims.
   */
  async deleteReader(shopId: string, readerId: string): Promise<void> {
    const stripeAccountId = await this.requireAccountId(shopId);
    const reader = await shopTerminalRepository.getReaderById(readerId, shopId);
    if (!reader) throw httpError('Reader not found.', 404);

    await shopTerminalRepository.deleteReader(readerId, shopId);

    try {
      await this.stripe.terminal.readers.del(reader.stripeReaderId, {
        stripeAccount: stripeAccountId,
      });
    } catch (error) {
      logger.warn('Reader unlinked locally but Stripe delete failed', {
        shopId,
        readerId: reader.stripeReaderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Short-lived token the browser SDK exchanges to talk to a reader. Minted on the connected
   * account so the SDK operates on the shop's readers, not the platform's.
   */
  async createConnectionToken(shopId: string): Promise<string> {
    const stripeAccountId = await this.requireAccountId(shopId);
    const token = await this.stripe.terminal.connectionTokens.create(
      {},
      { stripeAccount: stripeAccountId }
    );
    return token.secret;
  }

  /**
   * Sends a $1 authorization to the reader to prove the pairing works. `capture_method: manual`
   * means it is only ever authorized, never captured — cancelTestPayment releases it, so the
   * customer's card is not charged even if the shop runs this in live mode.
   */
  async startTestPayment(
    shopId: string,
    readerId: string
  ): Promise<{ paymentIntentId: string; readerId: string }> {
    const stripeAccountId = await this.requireAccountId(shopId);
    const reader = await shopTerminalRepository.getReaderById(readerId, shopId);
    if (!reader) throw httpError('Reader not found.', 404);

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: TEST_PAYMENT_AMOUNT_CENTS,
        currency: 'usd',
        payment_method_types: ['card_present'],
        capture_method: 'manual',
        description: 'FixFlow reader test',
        metadata: { shopId, terminalTest: 'true' },
      },
      { stripeAccount: stripeAccountId }
    );

    await this.stripe.terminal.readers.processPaymentIntent(
      reader.stripeReaderId,
      { payment_intent: paymentIntent.id },
      { stripeAccount: stripeAccountId }
    );

    return { paymentIntentId: paymentIntent.id, readerId: reader.stripeReaderId };
  }

  /**
   * Status of a test authorization. The reader accepts the handoff before it has done anything,
   * so a failure after that point shows up here — not as an error from startTestPayment.
   */
  async getTestPaymentStatus(
    shopId: string,
    paymentIntentId: string
  ): Promise<{ status: string; amount: number }> {
    const stripeAccountId = await this.requireAccountId(shopId);
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId, undefined, {
      stripeAccount: stripeAccountId,
    });
    return { status: intent.status, amount: intent.amount };
  }

  async cancelTestPayment(shopId: string, paymentIntentId: string): Promise<void> {
    const stripeAccountId = await this.requireAccountId(shopId);
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId, undefined, {
        stripeAccount: stripeAccountId,
      });
    } catch (error) {
      logger.warn('Failed to cancel Terminal test payment', {
        shopId,
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /** Whether this shop can use Terminal at all, for the setup screen's empty state. */
  async getReadiness(shopId: string): Promise<{
    terminalReady: boolean;
    cardPaymentsCapability: string;
    accountId: string | null;
  }> {
    const status = await getStripeConnectService().getAccountStatus(shopId);
    return {
      terminalReady: status.terminalReady,
      cardPaymentsCapability: status.cardPaymentsCapability,
      accountId: status.accountId,
    };
  }
}

let instance: StripeTerminalService | null = null;

export function getStripeTerminalService(): StripeTerminalService {
  if (!instance) instance = new StripeTerminalService();
  return instance;
}
