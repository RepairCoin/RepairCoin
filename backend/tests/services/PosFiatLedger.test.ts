import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

jest.mock('../../src/utils/database-pool', () => {
  const query = jest.fn();
  return { getSharedPool: () => ({ query, connect: jest.fn() }) };
});

import { getSharedPool } from '../../src/utils/database-pool';
import { PaymentRepository } from '../../src/repositories/PaymentRepository';

const mockQuery = (getSharedPool() as any).query as jest.MockedFunction<
  (...args: any[]) => Promise<any>
>;

const tender = (overrides: Record<string, any> = {}) => ({
  shopId: 'shop-1',
  posSaleId: 'sale-1',
  posSalePaymentId: 'tender-1',
  method: 'cash' as const,
  grossCents: 2500,
  ...overrides,
});

describe('PaymentRepository.recordPosTender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: 'pay-1', metadata: {} }] });
  });

  const sqlOf = () => String(mockQuery.mock.calls[0][0]);
  const paramsOf = () => mockQuery.mock.calls[0][1] as any[];

  it('keys a cash tender on the tender itself, since it has no PaymentIntent', async () => {
    await new PaymentRepository().recordPosTender(tender());

    expect(sqlOf()).toContain('ON CONFLICT (pos_sale_payment_id)');
    expect(sqlOf()).not.toContain('ON CONFLICT (stripe_payment_intent_id)');
  });

  it('keys a card tender on the PaymentIntent, so it meets whatever the webhook wrote', async () => {
    await new PaymentRepository().recordPosTender(
      tender({ method: 'card', stripePaymentIntentId: 'pi_123' })
    );

    expect(sqlOf()).toContain('ON CONFLICT (stripe_payment_intent_id)');
  });

  it('never overwrites money the reconciler resolved on a card tender', async () => {
    await new PaymentRepository().recordPosTender(
      tender({ method: 'card', stripePaymentIntentId: 'pi_123' })
    );

    // The webhook derives fees and net from the balance transaction and is authoritative. If a
    // completion landing afterwards updated these, it would zero out real numbers.
    const update = sqlOf().split('DO UPDATE SET')[1];
    for (const column of ['gross_cents', 'fee_cents', 'net_cents', 'status']) {
      expect(update).not.toContain(column);
    }
    expect(update).toContain('pos_sale_id');
  });

  it('files every counter tender as a terminal sale, not a booking', async () => {
    await new PaymentRepository().recordPosTender(tender());

    expect(paramsOf()).toContain('terminal');
  });
});

describe('PosSaleService ledger write', () => {
  const recordPosTender = jest.fn<(...a: any[]) => Promise<any>>();

  const loadService = async (payments: any[], customerAddress: string | null = null) => {
    jest.resetModules();
    recordPosTender.mockReset();
    recordPosTender.mockResolvedValue({ id: 'pay-1' });

    const sale = {
      id: 'sale-1',
      shopId: 'shop-1',
      currency: 'usd',
      customerAddress,
      locationId: null,
      saleNumber: 7,
      totalCents: 2500,
      items: [],
      payments,
    };

    jest.doMock('../../src/repositories', () => ({
      paymentRepository: { recordPosTender },
      posSaleRepository: { completeSale: async () => sale, getSale: async () => sale },
      shopTaxRepository: { resolveRateBps: async () => 0 },
      shopTerminalRepository: {},
    }));
    jest.doMock('../../src/services/StripeTerminalService', () => ({
      getStripeTerminalService: () => ({ requireAccountId: async () => 'acct_1' }),
    }));
    jest.doMock('../../src/events/EventBus', () => ({
      eventBus: { publish: async () => undefined },
      createDomainEvent: (...a: any[]) => a,
    }));

    const { getPosSaleService } = await import('../../src/domains/ShopDomain/services/PosSaleService');
    return getPosSaleService();
  };

  const cash = { id: 't-cash', method: 'cash', amountCents: 2500, status: 'succeeded', applicationFeeCents: 0, stripePaymentIntentId: null, capturedAt: null };
  const card = { id: 't-card', method: 'card', amountCents: 2500, status: 'succeeded', applicationFeeCents: 25, stripePaymentIntentId: 'pi_1', capturedAt: null };

  it('puts cash in the ledger — the whole point, since Stripe never sees it', async () => {
    const service = await loadService([cash]);
    await service.completeSale('shop-1', 'sale-1');

    expect(recordPosTender).toHaveBeenCalledTimes(1);
    const arg = recordPosTender.mock.calls[0][0] as any;
    expect(arg.method).toBe('cash');
    expect(arg.grossCents).toBe(2500);
    // Cash settles whole: nothing is deducted between the drawer and the shop.
    expect(arg.netCents).toBe(2500);
  });

  it('leaves a card leg net at zero for the webhook to resolve', async () => {
    const service = await loadService([card]);
    await service.completeSale('shop-1', 'sale-1');

    const arg = recordPosTender.mock.calls[0][0] as any;
    expect(arg.netCents).toBe(0);
    expect(arg.applicationFeeCents).toBe(25);
    expect(arg.stripePaymentIntentId).toBe('pi_1');
  });

  it('writes one row per tender on a split sale', async () => {
    const service = await loadService([cash, card]);
    await service.completeSale('shop-1', 'sale-1');

    expect(recordPosTender).toHaveBeenCalledTimes(2);
  });

  it('ignores tenders that never settled', async () => {
    const service = await loadService([
      { ...card, status: 'failed' },
      { ...cash, id: 't-2', status: 'canceled' },
    ]);
    await service.completeSale('shop-1', 'sale-1');

    expect(recordPosTender).not.toHaveBeenCalled();
  });

  it('completes the sale even if the ledger write fails', async () => {
    const service = await loadService([cash]);
    recordPosTender.mockRejectedValue(new Error('ledger down'));

    // The customer has paid. Bookkeeping must not be able to undo that.
    await expect(service.completeSale('shop-1', 'sale-1')).resolves.toMatchObject({ id: 'sale-1' });
  });
});
