import Stripe from 'stripe';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { getStripeService } from '../../../services/StripeService';
import { getStripeTerminalService } from '../../../services/StripeTerminalService';
import { computeCommissionCents } from '../../../utils/platformCommission';
import { apportionTax } from '../../../utils/apportionTax';
import { getSharedPool } from '../../../utils/database-pool';
import {
  customerRepository,
  paymentRepository,
  posSaleRepository,
  refundRepository,
  shopRepository,
  shopTaxRepository,
  shopTerminalRepository,
} from '../../../repositories';
import { deliverReceiptEmail } from './PosReceiptListener';
import { issueRefund, REFUND_REASONS } from '../../PaymentsDomain/services/RefundIssuer';
import type { Payment } from '../../../repositories/PaymentRepository';
import type { RefundReason } from '../../../repositories/RefundRepository';
import type {
  AddPosSaleItemInput,
  PosSale,
  PosSaleItemKind,
  PosSaleStatus,
  PosSaleWithDetails,
  PosTenderMethod,
} from '../../../repositories/PosSaleRepository';

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

const toCents = (dollars: unknown): number => Math.round(Number(dollars ?? 0) * 100);

/** Trimmed and lowercased, or null when it isn't an address we could send to. */
function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export interface PosRefundLeg {
  method: PosTenderMethod;
  amountCents: number;
}

export interface PosRefundResult {
  sale: PosSaleWithDetails;
  refundedCents: number;
  legs: PosRefundLeg[];
  /**
   * Legs that could not be reversed. Reported rather than thrown: once one tender has gone back,
   * hiding the rest behind an error would leave the cashier believing nothing happened.
   */
  failures: string[];
}

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
        `SELECT service_name, price_usd, taxable, warranty_days FROM shop_services
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
        // Snapshotted here rather than joined at read time: a shop that shortens its warranty next
        // month must not shorten the one it already promised on this line.
        warrantyDays: row.warranty_days ?? null,
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

  /**
   * Only a registered, active customer can be attached — a counter sale earns RCN on completion,
   * and there is nobody to credit otherwise. Passing null clears it back to a walk-in.
   */
  async setCustomer(
    shopId: string,
    saleId: string,
    customerAddress: string | null
  ): Promise<PosSaleWithDetails> {
    const address = customerAddress?.trim().toLowerCase() || null;

    if (address) {
      const customer = await customerRepository.getCustomer(address);
      if (!customer) {
        throw httpError('That customer is not registered yet.', 404);
      }
      if (!customer.isActive) {
        throw httpError('That customer account is suspended.', 400);
      }
    }

    const updated = await posSaleRepository.setCustomer(saleId, shopId, address);
    if (!updated) throw httpError('Sale not found, or no longer open.', 404);
    return this.requireSale(saleId, shopId);
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
        // `type` is what the webhook reconciler reads to file this as a counter sale rather than
        // a booking, in the case where the charge lands before the sale is completed.
        metadata: {
          shopId,
          posSaleId: saleId,
          type: 'pos_sale',
          ...(sale.customerAddress ? { customerAddress: sale.customerAddress } : {}),
        },
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
  async completeSale(
    shopId: string,
    saleId: string,
    options: { receiptEmail?: string | null } = {}
  ): Promise<PosSaleWithDetails> {
    if (options.receiptEmail !== undefined) {
      // A malformed address is dropped rather than raised. The card has already been run by the
      // time this is called, so refusing the completion over a typo would leave the shop holding a
      // paid sale it cannot close — the receipt is the part that's allowed to fail here.
      const receiptEmail = normalizeEmail(options.receiptEmail);
      if (options.receiptEmail && !receiptEmail) {
        logger.warn('POS receipt: ignoring an unusable email address', { saleId, shopId });
      }
      await posSaleRepository.setReceiptEmail(saleId, shopId, receiptEmail);
    }

    const sale = await posSaleRepository.completeSale(saleId, shopId);

    await this.writeToLedger(sale);

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
            // What the sale is worth before tax. Loyalty earns on this rather than the total, so
            // a state's tax rate can't decide whether a customer crosses an earning threshold.
            netCents: sale.subtotalCents - sale.discountCents,
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

  /**
   * Writes the sale's settled FIAT tenders into the fiat ledger — one row each, cash included.
   *
   * The ledger cannot be rebuilt from Stripe: a cash leg has no charge for the reconciler to
   * find, so a POS shop's Transactions page silently under-reported revenue by however much it
   * took over the counter. Card legs are written here too, keyed on the PaymentIntent, so the
   * webhook meets a row that already names the sale instead of creating a bare one.
   *
   * RCN and gift-card legs are deliberately NOT written (S9c-1). Neither is money the shop
   * received: RCN is a loyalty discount — which is exactly how the booking flow already treats it,
   * reducing the Stripe charge rather than paying part of it — and a gift card draws down revenue
   * that was recognised when the card was sold. Writing them would inflate every revenue figure
   * unless each query remembered to exclude them, and a filter that must be remembered in a dozen
   * places is the bug S9a spent a slice removing. The consequence to know: a sale's total no longer
   * equals the sum of its ledger rows whenever a non-fiat tender is involved.
   *
   * Failures are logged, never thrown: the customer has paid and the sale is complete, and a
   * bookkeeping write must not be able to undo that.
   */
  private async writeToLedger(sale: PosSaleWithDetails): Promise<void> {
    const fiat = sale.payments.filter(
      (p) => p.status === 'succeeded' && (p.method === 'cash' || p.method === 'card')
    );
    if (!fiat.length) return;

    const stripeAccountId = fiat.some((p) => p.stripePaymentIntentId)
      ? await getStripeTerminalService()
          .requireAccountId(sale.shopId)
          .catch(() => null)
      : null;

    const taxByPayment = apportionTax(sale.taxCents, fiat);

    for (const payment of fiat) {
      try {
        await paymentRepository.recordPosTender({
          shopId: sale.shopId,
          posSaleId: sale.id,
          posSalePaymentId: payment.id,
          method: payment.method === 'cash' ? 'cash' : 'card',
          grossCents: payment.amountCents,
          taxCents: taxByPayment.get(payment.id) ?? 0,
          applicationFeeCents: payment.applicationFeeCents,
          // Cash settles whole; a card leg's fees and net come from the balance transaction the
          // webhook resolves, so leaving it at zero here is a placeholder, not a claim.
          netCents: payment.method === 'cash' ? payment.amountCents : 0,
          currency: sale.currency || 'usd',
          customerAddress: sale.customerAddress,
          locationId: sale.locationId,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          stripeAccountId,
          capturedAt: payment.capturedAt,
        });
      } catch (error) {
        logger.error('Failed to write POS tender to the fiat ledger', {
          saleId: sale.id,
          salePaymentId: payment.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Discards a cart nobody paid for. Once a tender has settled the sale has to be completed and
   * then refunded instead — see the repository for why voiding around money is unrecoverable.
   *
   * The reason is worked out here rather than inferred from the failed update, because "you cannot
   * void this" without saying what to do next leaves a cashier holding an open till.
   */
  async voidSale(shopId: string, saleId: string, reason?: string): Promise<PosSale> {
    const voided = await posSaleRepository.voidSale(saleId, shopId, reason);
    if (voided) return voided;

    const sale = await this.requireSale(saleId, shopId);
    if (sale.status !== 'open') {
      throw httpError(`This sale is already ${sale.status} and cannot be cleared.`, 409);
    }

    const inFlight = sale.payments.filter(
      (p) => p.status === 'pending' || p.status === 'processing'
    );
    if (inFlight.length) {
      throw httpError(
        'A card payment is still in progress. Cancel it before clearing this sale.',
        409
      );
    }

    const settled = sale.payments.filter((p) => p.status === 'succeeded');
    const takenCents = settled.reduce((sum, p) => sum + p.amountCents, 0);
    throw httpError(
      `This sale has already taken ${(takenCents / 100).toFixed(2)}. Complete it and then refund it — clearing it would leave the money unaccounted for.`,
      409
    );
  }

  /**
   * Hands money back on a completed counter sale.
   *
   * Goes through the fiat ledger's own refund machinery rather than a POS-specific one: S6a already
   * writes every cash and card tender into `payments`, and `issueRefund` already knows how to
   * reverse a direct charge on the shop's connected account and claw the platform fee back with it.
   * A second refund path would be a second set of rules to keep in step.
   *
   * The sale is the unit, the tender is the mechanism. A shop refunds "sale #7", and this spreads
   * it across however many ways #7 was paid — card legs first because they are traceable and return
   * the commission, cash last because it comes out of the drawer.
   *
   * **Only cash and card are refundable here.** S9c-1 deliberately keeps RCN and gift-card tenders
   * out of the fiat ledger, so there is nothing to reverse; RCN already issued as loyalty on the
   * sale is not clawed back either — see the event note below.
   */
  async refundSale(
    shopId: string,
    saleId: string,
    input: {
      amountCents?: unknown;
      reason?: unknown;
      note?: unknown;
      restock?: boolean;
      actorAddress?: string | null;
    } = {}
  ): Promise<PosRefundResult> {
    const sale = await this.requireSale(saleId, shopId);
    if (sale.status !== 'completed' && sale.status !== 'partially_refunded') {
      throw httpError(`A ${sale.status} sale cannot be refunded.`, 409);
    }

    // Card first, then cash. A card leg reverses through Stripe and brings the application fee
    // back with it; cash leaves the drawer and can never be recovered if the order were flipped.
    const legs = sale.payments
      .filter((p) => p.status === 'succeeded' && (p.method === 'card' || p.method === 'cash'))
      .sort((a, b) => (a.method === b.method ? 0 : a.method === 'card' ? -1 : 1));

    if (!legs.length) {
      throw httpError('This sale has no card or cash payment to refund.', 400);
    }

    const refundable = legs.reduce((sum, p) => sum + (p.amountCents - p.refundedCents), 0);
    if (refundable <= 0) throw httpError('This sale has already been fully refunded.', 400);

    const amount = input.amountCents === undefined ? refundable : Number(input.amountCents);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw httpError('amountCents must be a positive integer.', 400);
    }
    if (amount > refundable) {
      throw httpError(`That is more than the ${refundable} cents still refundable.`, 400);
    }

    // Every ledger row is resolved BEFORE any money moves. A tender rung up before S6a wired the
    // POS into the ledger has no row to refund against, and finding that out halfway through would
    // leave a sale refunded on one leg and not the other.
    const planned: { leg: (typeof legs)[number]; ledger: Payment; allocCents: number }[] = [];
    let remaining = amount;
    for (const leg of legs) {
      if (remaining <= 0) break;
      const legRefundable = leg.amountCents - leg.refundedCents;
      if (legRefundable <= 0) continue;

      const ledger =
        (await paymentRepository.getByPosSalePayment(leg.id)) ??
        (leg.stripePaymentIntentId
          ? await paymentRepository.getByPaymentIntent(leg.stripePaymentIntentId)
          : null);
      if (!ledger) {
        throw httpError(
          'This sale predates the fiat ledger and cannot be refunded from FixFlow. Refund it in Stripe, or hand the cash back and record it manually.',
          409
        );
      }

      const allocCents = Math.min(remaining, legRefundable);
      planned.push({ leg, ledger, allocCents });
      remaining -= allocCents;
    }

    const refundedLegs: PosRefundLeg[] = [];
    const failures: string[] = [];

    for (const { leg, ledger, allocCents } of planned) {
      try {
        if (leg.method === 'cash') {
          await this.refundCashLeg(ledger, allocCents, input);
        } else {
          const result = await issueRefund({
            payment: ledger,
            amountCents: allocCents,
            reason: input.reason,
            note: input.note,
            actor: 'shop',
            actorAddress: input.actorAddress ?? null,
          });
          if (result.outcome === 'rejected') throw httpError(result.error, result.status);
        }

        await posSaleRepository.applyTenderRefund(leg.id, allocCents);
        refundedLegs.push({ method: leg.method, amountCents: allocCents });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failures.push(`${leg.method}: ${message}`);
        logger.error('POS refund leg failed', { saleId, salePaymentId: leg.id, error: message });
      }
    }

    const refundedNow = refundedLegs.reduce((sum, leg) => sum + leg.amountCents, 0);
    if (refundedNow === 0) {
      throw httpError(failures[0] ?? 'The refund could not be issued.', 502);
    }

    const fullyRefunded = refundedNow >= refundable;
    await posSaleRepository.setRefundStatus(
      saleId,
      shopId,
      fullyRefunded ? 'refunded' : 'partially_refunded'
    );

    await this.announceRefund(sale, refundedNow, fullyRefunded, input.restock === true);

    return {
      sale: await this.requireSale(saleId, shopId),
      refundedCents: refundedNow,
      legs: refundedLegs,
      failures,
    };
  }

  /**
   * Cash out of the drawer. No Stripe object exists or ever will, so this is the one place the
   * ledger's `refunded_cents` is written by us rather than by the `charge.refunded` webhook — the
   * same reasoning S9b used to write the ledger row for an off-Stripe booking instead of waiting
   * for a reconciliation that is never coming.
   *
   * **The two legs guard against a double refund differently, because they lag differently.** A
   * card leg's ledger figure trails the webhook, so `issueRefund` has to count its own pending
   * rows to know what is really outstanding. Nothing lags for cash — this side is the only writer —
   * so the authority is the ledger row itself, claimed with a guarded increment that two
   * simultaneous requests cannot both win.
   */
  private async refundCashLeg(
    ledger: Payment,
    amountCents: number,
    input: { reason?: unknown; note?: unknown; actorAddress?: string | null }
  ): Promise<void> {
    const reason = REFUND_REASONS.includes(input.reason as RefundReason)
      ? (input.reason as RefundReason)
      : 'requested_by_customer';
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 1000) : null;

    if (amountCents > ledger.grossCents - ledger.refundedCents) {
      throw httpError('That is more than this cash tender has left to refund.', 400);
    }

    // Recorded before the ledger moves, matching issueRefund: a row that exists but did not settle
    // is recoverable, a payout with no record of who authorised it is not.
    const refund = await refundRepository.createPending({
      paymentId: ledger.id,
      shopId: ledger.shopId,
      amountCents,
      currency: ledger.currency,
      reason,
      note,
      createdBy: input.actorAddress ?? null,
      createdByRole: 'shop',
    });

    // The check above is for a good error message; this is the one that decides. It matches no row
    // if another refund claimed the balance in between, and that has to fail rather than log —
    // nothing has left the drawer yet, and the caller is what tells the cashier to open it.
    const applied = await paymentRepository.applyOffStripeRefund(ledger.id, amountCents);
    if (!applied) {
      await refundRepository.markFailed(refund.id, 'Another refund claimed this balance first');
      throw httpError(
        'This tender was refunded by someone else a moment ago. Reload the sale to see what is left.',
        409
      );
    }

    await refundRepository.markSettledOffStripe(refund.id);
  }

  /**
   * Announces the refund for consumers to act on — inventory restocks returned products from here.
   *
   * Loyalty is deliberately NOT reversed. The RCN was an on-chain transfer plus an atomic balance
   * debit; the customer may have spent it, and a claw-back that fails has no good answer at a
   * counter where the refund has already been handed over. The asymmetry is real and accepted, in
   * the same way S6a accepts that cash sales carry no platform commission.
   */
  private async announceRefund(
    sale: PosSaleWithDetails,
    refundedCents: number,
    fullyRefunded: boolean,
    restock: boolean
  ): Promise<void> {
    try {
      await eventBus.publish(
        createDomainEvent(
          'pos.sale_refunded',
          sale.id,
          {
            saleId: sale.id,
            shopId: sale.shopId,
            locationId: sale.locationId,
            customerAddress: sale.customerAddress,
            saleNumber: sale.saleNumber,
            refundedCents,
            fullyRefunded,
            // Only a fully refunded sale can say which goods came back. On a partial refund the
            // amount says nothing about which lines it covered, so guessing would move stock that
            // is still on a customer's shelf.
            restock: restock && fullyRefunded,
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
      logger.error('Failed to publish pos.sale_refunded', {
        saleId: sale.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Sends the emailed receipt again, optionally to a different address. Unlike the send at
   * completion this one is allowed to fail loudly: the customer is standing there asking for it,
   * so a bad address or a rejected send is something the cashier can act on.
   *
   * Only the email copy. The in-app notification is a record that the sale happened, and
   * re-dispatching it would tell the customer they had paid a second time.
   */
  async resendReceipt(shopId: string, saleId: string, email?: unknown): Promise<{ sentTo: string }> {
    const sale = await this.requireSale(saleId, shopId);
    if (sale.status === 'open') {
      throw httpError('This sale has not been completed yet.', 409);
    }
    // A voided sale took no money, so a receipt for it would read as proof of a purchase that
    // never happened. The register hides the action, but the endpoint is reachable without it.
    if (sale.status === 'voided') {
      throw httpError('This sale was voided, so there is no receipt to send.', 409);
    }

    let target = sale.receiptEmail;
    if (email !== undefined && email !== null && String(email).trim()) {
      const normalized = normalizeEmail(email);
      if (!normalized) throw httpError('That email address is not usable.', 400);
      const redirected = await posSaleRepository.redirectReceipt(saleId, shopId, normalized);
      if (!redirected) throw httpError('Sale not found.', 404);
      target = normalized;
      sale.receiptEmail = normalized;
    }

    if (!target) {
      throw httpError('No email address on this sale — enter one to send a receipt.', 400);
    }

    const shopName = (await shopRepository.getShop(shopId))?.name || 'the shop';
    const sent = await deliverReceiptEmail(sale, target, shopName);
    if (!sent) throw httpError('The receipt could not be sent. Try again in a moment.', 502);

    return { sentTo: target };
  }

  async getSale(shopId: string, saleId: string): Promise<PosSaleWithDetails> {
    return this.requireSale(saleId, shopId);
  }

  listSales(
    shopId: string,
    options: {
      status?: PosSaleStatus;
      locationId?: string | null;
      saleNumber?: number | null;
      from?: string | null;
      to?: string | null;
      limit?: number;
      offset?: number;
    } = {}
  ) {
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
