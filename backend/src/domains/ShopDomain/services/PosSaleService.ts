import Stripe from 'stripe';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { getStripeService } from '../../../services/StripeService';
import { getStripeTerminalService } from '../../../services/StripeTerminalService';
import { computeCommissionCents } from '../../../utils/platformCommission';
import { getSharedPool } from '../../../utils/database-pool';
import {
  posSaleRepository,
  shopTaxRepository,
  shopTerminalRepository,
} from '../../../repositories';
import type {
  AddPosSaleItemInput,
  PosSale,
  PosSaleItemKind,
  PosSaleWithDetails,
  PosTenderMethod,
} from '../../../repositories/PosSaleRepository';

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

const toCents = (dollars: unknown): number => Math.round(Number(dollars ?? 0) * 100);

export interface AddItemRequest {
  kind: PosSaleItemKind;
  serviceId?: string;
  inventoryItemId?: string;
  name?: string;
  quantity?: number;
  unitPriceCents?: number;
  discountCents?: number;
  taxable?: boolean;
}

export class PosSaleService {
  private get stripe(): Stripe {
    return getStripeService().getStripe();
  }

  async createSale(
    shopId: string,
    input: { locationId?: string; customerAddress?: string; staffMemberId?: string; note?: string }
  ): Promise<PosSaleWithDetails> {
    const sale = await posSaleRepository.createSale({
      shopId,
      locationId: input.locationId ?? null,
      customerAddress: input.customerAddress?.toLowerCase() ?? null,
      staffMemberId: input.staffMemberId ?? null,
      note: input.note ?? null,
    });
    return (await posSaleRepository.getSale(sale.id, shopId))!;
  }

  /**
   * Resolves name and price from the shop's own catalogue rather than trusting the caller, and
   * scopes the lookup by shopId — otherwise a sale could reference another shop's service or
   * stock. The resolved values are snapshotted onto the line by the repository.
   */
  async addItem(shopId: string, saleId: string, req: AddItemRequest): Promise<PosSaleWithDetails> {
    const sale = await this.requireSale(saleId, shopId);
    const input = await this.resolveItem(shopId, req);
    await posSaleRepository.addItem(saleId, await this.applyTax(shopId, sale.locationId, input));
    return this.requireSale(saleId, shopId);
  }

  /**
   * Tax is charged per line, on the discounted amount, and rounded there rather than across the
   * whole sale — that is what a receipt has to show, and it keeps each line's stored tax true to
   * its own price once a line is refunded or voided on its own.
   *
   * A line the shop has marked non-taxable stays at zero regardless of the rate, which is how
   * labour is excluded in the states that don't tax it.
   */
  private async applyTax(
    shopId: string,
    locationId: string | null,
    input: AddPosSaleItemInput
  ): Promise<AddPosSaleItemInput> {
    if (input.taxable === false) return { ...input, taxRateBps: 0, taxCents: 0 };

    const rateBps = await shopTaxRepository.resolveRateBps(shopId, locationId);
    if (rateBps <= 0) return { ...input, taxRateBps: 0, taxCents: 0 };

    const base = (input.quantity ?? 1) * input.unitPriceCents - (input.discountCents ?? 0);
    return {
      ...input,
      taxRateBps: rateBps,
      taxCents: Math.max(Math.round((base * rateBps) / 10000), 0),
    };
  }

  /**
   * A service's cost of goods is the parts it consumes — the same rows the sale later deducts from
   * stock, so cost and stock movement agree. It stays null when nothing is linked rather than
   * defaulting to zero, because "no parts recorded" and "labour only" are indistinguishable here
   * and only one of them is free. Labour cost is not modelled, so this is a parts-only figure.
   */
  private async serviceCostCents(serviceId: string): Promise<number | null> {
    const result = await getSharedPool().query(
      `SELECT SUM(sii.quantity_required * ii.cost) AS cost
       FROM service_inventory_items sii
       JOIN inventory_items ii ON ii.id = sii.inventory_item_id
       WHERE sii.service_id = $1 AND ii.deleted_at IS NULL AND ii.cost IS NOT NULL`,
      [serviceId]
    );
    const cost = result.rows[0]?.cost;
    return cost === null || cost === undefined ? null : toCents(cost);
  }

  private async resolveItem(shopId: string, req: AddItemRequest): Promise<AddPosSaleItemInput> {
    const pool = getSharedPool();
    const quantity = req.quantity && req.quantity > 0 ? req.quantity : 1;
    const discountCents = req.discountCents ?? 0;

    if (req.kind === 'service') {
      if (!req.serviceId) throw httpError('serviceId is required for a service line.', 400);
      const result = await pool.query(
        `SELECT service_name, price_usd, taxable FROM shop_services
         WHERE service_id = $1 AND shop_id = $2`,
        [req.serviceId, shopId]
      );
      const row = result.rows[0];
      if (!row) throw httpError('Service not found for this shop.', 404);
      return {
        kind: 'service',
        serviceId: req.serviceId,
        name: row.service_name,
        quantity,
        unitPriceCents: req.unitPriceCents ?? toCents(row.price_usd),
        discountCents,
        taxable: row.taxable !== false,
        unitCostCents: await this.serviceCostCents(req.serviceId),
      };
    }

    if (req.kind === 'product') {
      if (!req.inventoryItemId) {
        throw httpError('inventoryItemId is required for a product line.', 400);
      }
      const result = await pool.query(
        `SELECT name, price, cost, taxable FROM inventory_items
         WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL`,
        [req.inventoryItemId, shopId]
      );
      const row = result.rows[0];
      if (!row) throw httpError('Product not found for this shop.', 404);
      return {
        kind: 'product',
        inventoryItemId: req.inventoryItemId,
        name: row.name,
        quantity,
        unitPriceCents: req.unitPriceCents ?? toCents(row.price),
        discountCents,
        taxable: row.taxable !== false,
        unitCostCents: row.cost === null || row.cost === undefined ? null : toCents(row.cost),
      };
    }

    if (!req.name?.trim()) throw httpError('A custom line needs a name.', 400);
    if (req.unitPriceCents === undefined) {
      throw httpError('A custom line needs a unit price.', 400);
    }
    return {
      kind: 'custom',
      name: req.name.trim(),
      quantity,
      unitPriceCents: req.unitPriceCents,
      discountCents,
      taxable: req.taxable !== false,
    };
  }

  async removeItem(shopId: string, saleId: string, itemId: string): Promise<PosSaleWithDetails> {
    const removed = await posSaleRepository.removeItem(saleId, itemId);
    if (!removed) throw httpError('Line not found on this sale.', 404);
    return this.requireSale(saleId, shopId);
  }

  /**
   * Cash is recorded as settled immediately — there is no authorisation step and no Stripe
   * object behind it, which is exactly why the fiat ledger cannot be rebuilt from Stripe alone.
   */
  async takeCashPayment(
    shopId: string,
    saleId: string,
    amountCents: number,
    tenderedCents?: number
  ): Promise<PosSaleWithDetails> {
    const sale = await this.requireSale(saleId, shopId);
    this.assertTenderable(sale, amountCents);

    await posSaleRepository.addPayment(saleId, {
      method: 'cash',
      amountCents,
      tenderedCents: tenderedCents ?? amountCents,
      status: 'succeeded',
    });
    return this.requireSale(saleId, shopId);
  }

  /**
   * Hands the outstanding balance to a reader. Commission is taken on this leg only: a cash leg
   * has no charge to attach an application fee to, so a split sale is commissioned on what
   * actually runs through Stripe.
   */
  async startCardPayment(
    shopId: string,
    saleId: string,
    readerId: string,
    amountCents?: number
  ): Promise<{ sale: PosSaleWithDetails; salePaymentId: string; paymentIntentId: string }> {
    const sale = await this.requireSale(saleId, shopId);
    const amount = amountCents ?? sale.balanceCents;
    this.assertTenderable(sale, amount);

    const terminal = getStripeTerminalService();
    const stripeAccountId = await terminal.requireAccountId(shopId);

    const reader = await shopTerminalRepository.getReaderById(readerId, shopId);
    if (!reader) throw httpError('Reader not found.', 404);

    const commissionCents = await computeCommissionCents(shopId, amount);

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount,
        currency: sale.currency || 'usd',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        ...(commissionCents > 0 ? { application_fee_amount: commissionCents } : {}),
        metadata: { shopId, posSaleId: saleId },
      },
      { stripeAccount: stripeAccountId }
    );

    const payment = await posSaleRepository.addPayment(saleId, {
      method: 'card',
      amountCents: amount,
      status: 'processing',
      stripePaymentIntentId: paymentIntent.id,
      stripeReaderId: reader.stripeReaderId,
      applicationFeeCents: commissionCents,
    });

    await this.stripe.terminal.readers.processPaymentIntent(
      reader.stripeReaderId,
      { payment_intent: paymentIntent.id },
      { stripeAccount: stripeAccountId }
    );

    return {
      sale: await this.requireSale(saleId, shopId),
      salePaymentId: payment.id,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Reconciles a card leg against Stripe. The reader accepts the handoff before it has done
   * anything, so this is the only place the outcome becomes known.
   */
  async syncCardPayment(
    shopId: string,
    saleId: string,
    salePaymentId: string
  ): Promise<PosSaleWithDetails> {
    const sale = await this.requireSale(saleId, shopId);
    const payment = sale.payments.find((p) => p.id === salePaymentId);
    if (!payment) throw httpError('Payment not found on this sale.', 404);
    if (!payment.stripePaymentIntentId) return sale;

    const stripeAccountId = await getStripeTerminalService().requireAccountId(shopId);
    const intent = await this.stripe.paymentIntents.retrieve(
      payment.stripePaymentIntentId,
      undefined,
      { stripeAccount: stripeAccountId }
    );

    const status =
      intent.status === 'succeeded'
        ? 'succeeded'
        : intent.status === 'canceled'
        ? 'canceled'
        : intent.status === 'processing' || intent.status === 'requires_capture'
        ? 'processing'
        : intent.status === 'requires_payment_method' && payment.status === 'processing'
        ? 'processing'
        : 'failed';

    await posSaleRepository.updatePaymentStatus(salePaymentId, status, {
      failureReason: intent.last_payment_error?.message ?? null,
    });

    return this.requireSale(saleId, shopId);
  }

  async cancelCardPayment(
    shopId: string,
    saleId: string,
    salePaymentId: string
  ): Promise<PosSaleWithDetails> {
    const sale = await this.requireSale(saleId, shopId);
    const payment = sale.payments.find((p) => p.id === salePaymentId);
    if (!payment) throw httpError('Payment not found on this sale.', 404);

    const stripeAccountId = await getStripeTerminalService().requireAccountId(shopId);

    if (payment.stripeReaderId) {
      await this.stripe.terminal.readers
        .cancelAction(payment.stripeReaderId, { stripeAccount: stripeAccountId })
        .catch(() => undefined);
    }
    if (payment.stripePaymentIntentId) {
      await this.stripe.paymentIntents
        .cancel(payment.stripePaymentIntentId, undefined, { stripeAccount: stripeAccountId })
        .catch(() => undefined);
    }

    await posSaleRepository.updatePaymentStatus(salePaymentId, 'canceled');
    return this.requireSale(saleId, shopId);
  }

  /**
   * Completes the sale and announces it. Consumers — inventory, loyalty, receipts — subscribe
   * rather than being called here, so a failure in any of them can never fail the sale that
   * has already taken the customer's money.
   */
  async completeSale(shopId: string, saleId: string): Promise<PosSaleWithDetails> {
    const sale = await posSaleRepository.completeSale(saleId, shopId);

    try {
      await eventBus.publish(
        createDomainEvent(
          'pos.sale_completed',
          sale.id,
          {
            saleId: sale.id,
            shopId: sale.shopId,
            locationId: sale.locationId,
            customerAddress: sale.customerAddress,
            saleNumber: sale.saleNumber,
            totalCents: sale.totalCents,
            items: sale.items.map((item) => ({
              kind: item.kind,
              serviceId: item.serviceId,
              inventoryItemId: item.inventoryItemId,
              quantity: item.quantity,
              name: item.name,
            })),
          },
          'ShopDomain'
        )
      );
    } catch (error) {
      logger.error('Failed to publish pos.sale_completed', {
        saleId: sale.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return sale;
  }

  async voidSale(shopId: string, saleId: string, reason?: string): Promise<PosSale> {
    const voided = await posSaleRepository.voidSale(saleId, shopId, reason);
    if (!voided) throw httpError('Only an open sale can be voided.', 409);
    return voided;
  }

  async getSale(shopId: string, saleId: string): Promise<PosSaleWithDetails> {
    return this.requireSale(saleId, shopId);
  }

  listSales(shopId: string, options: { limit?: number } = {}) {
    return posSaleRepository.listSales(shopId, options);
  }

  /**
   * Windows are rolling hours back from now, not calendar days: shops have no timezone recorded,
   * so "today" would silently mean UTC midnight and cut a west-coast evening's takings in half.
   */
  getSummary(shopId: string, options: { days?: number; locationId?: string | null } = {}) {
    const days = Math.min(Math.max(options.days ?? 1, 1), 365);
    return posSaleRepository.getSummary(shopId, {
      since: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      locationId: options.locationId ?? null,
    });
  }

  private async requireSale(saleId: string, shopId: string): Promise<PosSaleWithDetails> {
    const sale = await posSaleRepository.getSale(saleId, shopId);
    if (!sale) throw httpError('Sale not found.', 404);
    return sale;
  }

  private assertTenderable(sale: PosSaleWithDetails, amountCents: number): void {
    if (sale.status !== 'open') {
      throw httpError(`This sale is ${sale.status} and can no longer take payment.`, 409);
    }
    if (amountCents <= 0) throw httpError('Payment amount must be greater than zero.', 400);
    if (amountCents > sale.balanceCents) {
      throw httpError(
        `That is more than the ${sale.balanceCents} cents outstanding on this sale.`,
        400
      );
    }
  }
}

export function assertSupportedTender(method: PosTenderMethod): void {
  if (method === 'gift_card') {
    throw httpError('Gift cards are not supported yet.', 400);
  }
}

let instance: PosSaleService | null = null;

export function getPosSaleService(): PosSaleService {
  if (!instance) instance = new PosSaleService();
  return instance;
}
