import { describe, it, expect, beforeEach, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

describe('POS receipt listener', () => {
  const getSale = jest.fn<(...a: any[]) => Promise<any>>();
  const markReceiptSent = jest.fn<(...a: any[]) => Promise<any>>();
  const getCustomer = jest.fn<(...a: any[]) => Promise<any>>();
  const getShop = jest.fn<(...a: any[]) => Promise<any>>();
  const dispatch = jest.fn<(...a: any[]) => Promise<any>>();
  const sendPosReceipt = jest.fn<(...a: any[]) => Promise<any>>();

  const sale = (over: Record<string, any> = {}) => ({
    id: 'sale-1',
    shopId: 'shop-1',
    customerAddress: '0xabc',
    saleNumber: 7,
    subtotalCents: 10000,
    discountCents: 0,
    taxCents: 825,
    totalCents: 10825,
    receiptEmail: null,
    completedAt: '2026-08-06T10:00:00.000Z',
    items: [{ name: 'Screen repair', quantity: 1, totalCents: 10825, warrantyDays: null }],
    payments: [
      { method: 'cash', amountCents: 10825, changeCents: 175, status: 'succeeded' },
    ],
    ...over,
  });

  const load = async () => {
    jest.resetModules();
    [getSale, markReceiptSent, getCustomer, getShop, dispatch, sendPosReceipt].forEach((m) =>
      m.mockReset()
    );
    getSale.mockResolvedValue(sale());
    markReceiptSent.mockResolvedValue(undefined);
    getCustomer.mockResolvedValue({ email: 'onfile@example.com' });
    getShop.mockResolvedValue({ name: 'Fix It Fast' });
    dispatch.mockResolvedValue(null);
    sendPosReceipt.mockResolvedValue(true);

    jest.doMock('../../src/repositories', () => ({
      posSaleRepository: { getSale, markReceiptSent },
      customerRepository: { getCustomer },
      shopRepository: { getShop },
    }));
    jest.doMock('../../src/domains/notification/services/NotificationGateway', () => ({
      getNotificationGateway: () => ({ dispatch }),
    }));
    jest.doMock('../../src/services/EmailService', () => ({
      EmailService: class {
        sendPosReceipt = sendPosReceipt;
      },
    }));
    jest.doMock('../../src/events/EventBus', () => ({ eventBus: { subscribe: jest.fn() } }));

    const mod = await import('../../src/domains/ShopDomain/services/PosReceiptListener');
    return mod.sendReceiptForSale;
  };

  const event = (over: Record<string, any> = {}) => ({
    data: {
      saleId: 'sale-1',
      shopId: 'shop-1',
      customerAddress: '0xabc',
      saleNumber: 7,
      totalCents: 10825,
      ...over,
    },
  });

  beforeEach(() => jest.clearAllMocks());

  it('sends nothing for a walk-in who left no email', async () => {
    const run = await load();
    getSale.mockResolvedValue(sale({ customerAddress: null }));
    await run(event({ customerAddress: null }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(sendPosReceipt).not.toHaveBeenCalled();
  });

  it('emails a walk-in who gave an address at the register', async () => {
    const run = await load();
    getSale.mockResolvedValue(sale({ customerAddress: null, receiptEmail: 'walkin@example.com' }));
    await run(event({ customerAddress: null }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(sendPosReceipt).toHaveBeenCalledTimes(1);
    expect((sendPosReceipt.mock.calls[0][0] as any).customerEmail).toBe('walkin@example.com');
    expect(markReceiptSent).toHaveBeenCalledWith('sale-1');
  });

  it('gives an attached customer both the in-app receipt and the email on file', async () => {
    const run = await load();
    await run(event());

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toBe('pos_sale_receipt');
    expect(dispatch.mock.calls[0][1]).toBe('0xabc');
    expect((sendPosReceipt.mock.calls[0][0] as any).customerEmail).toBe('onfile@example.com');
  });

  it('prefers the address typed at the register over the one on file', async () => {
    const run = await load();
    getSale.mockResolvedValue(sale({ receiptEmail: 'typed@example.com' }));
    await run(event());

    expect((sendPosReceipt.mock.calls[0][0] as any).customerEmail).toBe('typed@example.com');
  });

  it('still notifies in-app when the customer has no email anywhere', async () => {
    const run = await load();
    getCustomer.mockResolvedValue({ email: null });
    await run(event());

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(sendPosReceipt).not.toHaveBeenCalled();
  });

  it('bills only the settled tenders, so they sum to what was paid', async () => {
    const run = await load();
    getSale.mockResolvedValue(
      sale({
        receiptEmail: 'walkin@example.com',
        payments: [
          { method: 'card', amountCents: 5000, changeCents: null, status: 'failed' },
          { method: 'card', amountCents: 5000, changeCents: null, status: 'succeeded' },
          { method: 'cash', amountCents: 5825, changeCents: 175, status: 'succeeded' },
        ],
      })
    );
    await run(event());

    const arg = sendPosReceipt.mock.calls[0][0] as any;
    expect(arg.tenders).toEqual([
      { label: 'Card', amountCents: 5000 },
      { label: 'Cash', amountCents: 5825 },
    ]);
    expect(arg.changeCents).toBe(175);
  });

  it('tells the customer what is covered and until when', async () => {
    const run = await load();
    getSale.mockResolvedValue(
      sale({
        receiptEmail: 'walkin@example.com',
        items: [
          { name: 'Screen repair', quantity: 1, totalCents: 10000, warrantyDays: 90 },
          { name: 'Phone case', quantity: 1, totalCents: 825, warrantyDays: null },
        ],
      })
    );
    await run(event());

    const items = (sendPosReceipt.mock.calls[0][0] as any).items;
    expect(items[0].warrantyLabel).toBe('90-day warranty — covered to Nov 4, 2026');
    // The uncovered line carries no label at all, rather than one announcing no cover.
    expect(items[1].warrantyLabel).toBeUndefined();
  });

  it('does not record a send the mailer refused', async () => {
    const run = await load();
    getSale.mockResolvedValue(sale({ receiptEmail: 'walkin@example.com' }));
    sendPosReceipt.mockResolvedValue(false);
    await run(event());

    expect(markReceiptSent).not.toHaveBeenCalled();
  });

  it('swallows a failure rather than escaping into the event bus', async () => {
    const run = await load();
    getSale.mockRejectedValue(new Error('db down'));

    await expect(run(event())).resolves.toBeUndefined();
  });

  it('still emails when the in-app notification fails', async () => {
    const run = await load();
    dispatch.mockRejectedValue(new Error('push service down'));
    await run(event());

    expect(sendPosReceipt).toHaveBeenCalledTimes(1);
  });
});
