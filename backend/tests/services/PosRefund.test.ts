import { describe, it, expect, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

/**
 * Refunding a counter sale. The sale is the unit a shop asks for, but the money went out across
 * however many tenders it was paid with, so almost everything worth testing here is the allocation
 * between those tenders and which of them is allowed to move first.
 */
describe('POS refunds', () => {
  const getSale = jest.fn<(...a: any[]) => Promise<any>>();
  const applyTenderRefund = jest.fn<(...a: any[]) => Promise<any>>();
  const setRefundStatus = jest.fn<(...a: any[]) => Promise<any>>();
  const getByPosSalePayment = jest.fn<(...a: any[]) => Promise<any>>();
  const getByPaymentIntent = jest.fn<(...a: any[]) => Promise<any>>();
  const markRefunded = jest.fn<(...a: any[]) => Promise<any>>();
  const createPending = jest.fn<(...a: any[]) => Promise<any>>();
  const markSettledOffStripe = jest.fn<(...a: any[]) => Promise<any>>();
  const issueRefund = jest.fn<(...a: any[]) => Promise<any>>();
  const publish = jest.fn<(...a: any[]) => Promise<any>>();

  const tender = (over: Record<string, any> = {}) => ({
    id: 'tender-1',
    method: 'card',
    amountCents: 5000,
    refundedCents: 0,
    status: 'succeeded',
    stripePaymentIntentId: 'pi_1',
    applicationFeeCents: 50,
    capturedAt: null,
    ...over,
  });

  const sale = (over: Record<string, any> = {}) => ({
    id: 'sale-1',
    shopId: 'shop-1',
    locationId: 'loc-1',
    customerAddress: null,
    saleNumber: 7,
    status: 'completed',
    currency: 'usd',
    subtotalCents: 5000,
    discountCents: 0,
    taxCents: 0,
    totalCents: 5000,
    items: [
      { kind: 'product', serviceId: null, inventoryItemId: 'item-1', quantity: 1, name: 'Case' },
    ],
    payments: [tender()],
    ...over,
  });

  const load = async (saleRow: any) => {
    jest.resetModules();
    [
      getSale,
      applyTenderRefund,
      setRefundStatus,
      getByPosSalePayment,
      getByPaymentIntent,
      markRefunded,
      createPending,
      markSettledOffStripe,
      issueRefund,
      publish,
    ].forEach((m) => m.mockReset());

    getSale.mockResolvedValue(saleRow);
    applyTenderRefund.mockResolvedValue(undefined);
    setRefundStatus.mockResolvedValue(saleRow);
    // Every tender has a ledger row unless a test says otherwise.
    getByPosSalePayment.mockImplementation(async (id: any) => ({
      id: `pay-${id}`,
      shopId: 'shop-1',
      currency: 'usd',
      grossCents: 5000,
      refundedCents: 0,
      status: 'succeeded',
    }));
    getByPaymentIntent.mockResolvedValue(null);
    markRefunded.mockResolvedValue(null);
    createPending.mockResolvedValue({ id: 'refund-1' });
    markSettledOffStripe.mockResolvedValue(null);
    issueRefund.mockResolvedValue({ outcome: 'issued', refund: { id: 'refund-1' } });
    publish.mockResolvedValue(undefined);

    jest.doMock('../../src/repositories', () => ({
      posSaleRepository: { getSale, applyTenderRefund, setRefundStatus },
      paymentRepository: { getByPosSalePayment, getByPaymentIntent, markRefunded },
      refundRepository: { createPending, markSettledOffStripe },
      customerRepository: {},
      shopRepository: {},
      shopTaxRepository: {},
      shopTerminalRepository: {},
    }));
    jest.doMock('../../src/domains/PaymentsDomain/services/RefundIssuer', () => ({
      issueRefund,
      REFUND_REASONS: ['requested_by_customer', 'duplicate', 'fraudulent'],
    }));
    jest.doMock('../../src/domains/ShopDomain/services/PosReceiptListener', () => ({
      deliverReceiptEmail: jest.fn(),
    }));
    jest.doMock('../../src/events/EventBus', () => ({
      eventBus: { publish, subscribe: jest.fn() },
      createDomainEvent: (type: string, id: string, data: any) => ({ type, id, data }),
    }));
    jest.doMock('../../src/services/StripeService', () => ({ getStripeService: () => ({}) }));
    jest.doMock('../../src/services/StripeTerminalService', () => ({
      getStripeTerminalService: () => ({ requireAccountId: async () => 'acct_1' }),
    }));

    const mod = await import('../../src/domains/ShopDomain/services/PosSaleService');
    return mod.getPosSaleService();
  };

  const eventData = () => (publish.mock.calls[0][0] as any).data;

  it('reverses the card leg before touching the drawer', async () => {
    const service = await load(
      sale({
        totalCents: 8000,
        payments: [
          tender({ id: 'cash-1', method: 'cash', amountCents: 3000, stripePaymentIntentId: null }),
          tender({ id: 'card-1', method: 'card', amountCents: 5000 }),
        ],
      })
    );

    // Only $50 of the $80 sale — it must all come off the card, which is recoverable, rather than
    // out of a till that can never get it back.
    const result = await service.refundSale('shop-1', 'sale-1', { amountCents: 5000 });

    expect(result.legs).toEqual([{ method: 'card', amountCents: 5000 }]);
    expect(issueRefund).toHaveBeenCalledTimes(1);
    expect(createPending).not.toHaveBeenCalled();
  });

  it('spills onto cash only once the card leg is exhausted', async () => {
    const service = await load(
      sale({
        totalCents: 8000,
        payments: [
          tender({ id: 'cash-1', method: 'cash', amountCents: 3000, stripePaymentIntentId: null }),
          tender({ id: 'card-1', method: 'card', amountCents: 5000 }),
        ],
      })
    );

    const result = await service.refundSale('shop-1', 'sale-1', { amountCents: 6500 });

    expect(result.legs).toEqual([
      { method: 'card', amountCents: 5000 },
      { method: 'cash', amountCents: 1500 },
    ]);
  });

  it('writes the ledger itself for cash, because no webhook is coming', async () => {
    const service = await load(
      sale({
        payments: [
          tender({ id: 'cash-1', method: 'cash', amountCents: 5000, stripePaymentIntentId: null }),
        ],
      })
    );

    await service.refundSale('shop-1', 'sale-1');

    expect(createPending).toHaveBeenCalled();
    expect(markRefunded).toHaveBeenCalledWith('pay-cash-1', 5000, 'refunded');
    expect(markSettledOffStripe).toHaveBeenCalledWith('refund-1');
  });

  it('leaves the ledger to the reconciler on a card leg', async () => {
    const service = await load(sale());

    await service.refundSale('shop-1', 'sale-1');

    // `charge.refunded` owns payments.refunded_cents for anything with a Stripe object, and a
    // refund issued from the Stripe dashboard would never pass through here.
    expect(markRefunded).not.toHaveBeenCalled();
    expect(applyTenderRefund).toHaveBeenCalledWith('tender-1', 5000);
  });

  it('cannot refund an RCN tender, and does not count it as refundable', async () => {
    const service = await load(
      sale({
        totalCents: 8000,
        payments: [
          tender({ id: 'rcn-1', method: 'rcn', amountCents: 3000, stripePaymentIntentId: null }),
          tender({ id: 'card-1', method: 'card', amountCents: 5000 }),
        ],
      })
    );

    const result = await service.refundSale('shop-1', 'sale-1');

    expect(result.refundedCents).toBe(5000);
    await expect(
      service.refundSale('shop-1', 'sale-1', { amountCents: 8000 })
    ).rejects.toThrow(/still refundable/);
  });

  it('marks the sale partially refunded when money is left on it', async () => {
    const service = await load(sale());

    await service.refundSale('shop-1', 'sale-1', { amountCents: 2000 });

    expect(setRefundStatus).toHaveBeenCalledWith('sale-1', 'shop-1', 'partially_refunded');
  });

  it('marks it refunded once nothing is left', async () => {
    const service = await load(sale({ payments: [tender({ refundedCents: 3000 })] }));

    await service.refundSale('shop-1', 'sale-1');

    expect(setRefundStatus).toHaveBeenCalledWith('sale-1', 'shop-1', 'refunded');
    expect(applyTenderRefund).toHaveBeenCalledWith('tender-1', 5000);
  });

  it('withholds restock on a partial refund, where nothing says which lines came back', async () => {
    const service = await load(sale());

    await service.refundSale('shop-1', 'sale-1', { amountCents: 2000, restock: true });

    expect(eventData().restock).toBe(false);
  });

  it('restocks a full refund when the shop asks for it', async () => {
    const service = await load(sale());

    await service.refundSale('shop-1', 'sale-1', { restock: true });

    expect(eventData().restock).toBe(true);
  });

  it('refuses before moving any money when a tender has no ledger row', async () => {
    const service = await load(
      sale({
        totalCents: 8000,
        payments: [
          tender({ id: 'card-1', method: 'card', amountCents: 5000 }),
          tender({ id: 'cash-1', method: 'cash', amountCents: 3000, stripePaymentIntentId: null }),
        ],
      })
    );
    getByPosSalePayment.mockImplementation(async (id: any) =>
      id === 'cash-1' ? null : { id: `pay-${id}`, shopId: 'shop-1', currency: 'usd', grossCents: 5000, refundedCents: 0, status: 'succeeded' }
    );

    // The card leg is resolvable and comes first — but a refund that reverses one tender and then
    // discovers it cannot reverse the other is worse than one that never started.
    await expect(service.refundSale('shop-1', 'sale-1')).rejects.toThrow(/predates the fiat ledger/);
    expect(issueRefund).not.toHaveBeenCalled();
  });

  it('will not refund a sale that was never completed', async () => {
    const service = await load(sale({ status: 'voided' }));

    await expect(service.refundSale('shop-1', 'sale-1')).rejects.toThrow(/voided sale cannot/);
  });

  it('reports a failed leg rather than hiding it behind an error', async () => {
    const service = await load(
      sale({
        totalCents: 8000,
        payments: [
          tender({ id: 'card-1', method: 'card', amountCents: 5000 }),
          tender({ id: 'cash-1', method: 'cash', amountCents: 3000, stripePaymentIntentId: null }),
        ],
      })
    );
    issueRefund.mockResolvedValue({ outcome: 'rejected', status: 502, error: 'Stripe said no' });

    const result = await service.refundSale('shop-1', 'sale-1');

    // The cash went back. Throwing here would tell the cashier nothing happened.
    expect(result.refundedCents).toBe(3000);
    expect(result.failures).toEqual(['card: Stripe said no']);
    expect(setRefundStatus).toHaveBeenCalledWith('sale-1', 'shop-1', 'partially_refunded');
  });
});
