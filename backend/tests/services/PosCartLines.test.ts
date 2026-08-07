import { describe, it, expect, jest } from '@jest/globals';

process.env.SKIP_DB_CONNECTION_TESTS = 'true';

/**
 * Ringing the same thing up twice should be one line of two, not two lines of one — and once it is
 * one line, the cashier needs a way to count it back down that is not "delete it and start again".
 */
describe('POS cart lines', () => {
  const getSale = jest.fn<(...a: any[]) => Promise<any>>();
  const addItem = jest.fn<(...a: any[]) => Promise<any>>();
  const setItemQuantity = jest.fn<(...a: any[]) => Promise<any>>();
  const removeItem = jest.fn<(...a: any[]) => Promise<any>>();
  const resolveRateBps = jest.fn<(...a: any[]) => Promise<any>>();
  const poolQuery = jest.fn<(...a: any[]) => Promise<any>>();

  const line = (over: Record<string, any> = {}) => ({
    id: 'line-1',
    kind: 'product',
    serviceId: null,
    inventoryItemId: 'item-1',
    name: 'Case',
    quantity: 1,
    unitPriceCents: 1000,
    discountCents: 0,
    taxable: true,
    taxRateBps: 0,
    taxCents: 0,
    totalCents: 1000,
    ...over,
  });

  const sale = (items: any[] = []) => ({
    id: 'sale-1',
    shopId: 'shop-1',
    locationId: 'loc-1',
    status: 'open',
    items,
    payments: [],
  });

  const load = async (saleRow: any, catalogue: Record<string, any> = {}) => {
    jest.resetModules();
    [getSale, addItem, setItemQuantity, removeItem, resolveRateBps, poolQuery].forEach((m) =>
      m.mockReset()
    );

    getSale.mockResolvedValue(saleRow);
    addItem.mockResolvedValue({ id: 'new-line' });
    setItemQuantity.mockResolvedValue({ id: 'line-1' });
    removeItem.mockResolvedValue(true);
    resolveRateBps.mockResolvedValue(0);

    // The catalogue lookup resolveItem does, plus the parts-cost query behind a service line.
    poolQuery.mockImplementation(async (sql: any) =>
      String(sql).includes('service_inventory_items')
        ? { rows: [{ cost: null }] }
        : { rows: [catalogue.row ?? { name: 'Case', price: 10, cost: 4, taxable: true }] }
    );

    jest.doMock('../../src/utils/database-pool', () => ({
      getSharedPool: () => ({ query: poolQuery, connect: jest.fn() }),
    }));
    jest.doMock('../../src/repositories', () => ({
      posSaleRepository: { getSale, addItem, setItemQuantity, removeItem },
      shopTaxRepository: { resolveRateBps },
      customerRepository: {},
      paymentRepository: {},
      refundRepository: {},
      shopRepository: {},
      shopTerminalRepository: {},
    }));
    jest.doMock('../../src/domains/PaymentsDomain/services/RefundIssuer', () => ({
      issueRefund: jest.fn(),
      REFUND_REASONS: [],
    }));
    jest.doMock('../../src/domains/ShopDomain/services/PosReceiptListener', () => ({
      deliverReceiptEmail: jest.fn(),
    }));
    jest.doMock('../../src/events/EventBus', () => ({
      eventBus: { publish: jest.fn(), subscribe: jest.fn() },
      createDomainEvent: (t: string, i: string, d: any) => ({ type: t, id: i, data: d }),
    }));
    jest.doMock('../../src/services/StripeService', () => ({ getStripeService: () => ({}) }));
    jest.doMock('../../src/services/StripeTerminalService', () => ({
      getStripeTerminalService: () => ({}),
    }));

    const mod = await import('../../src/domains/ShopDomain/services/PosSaleService');
    return mod.getPosSaleService();
  };

  const product = { kind: 'product' as const, inventoryItemId: 'item-1' };

  describe('adding the same thing twice', () => {
    it('bumps the existing line rather than starting another', async () => {
      const service = await load(sale([line({ quantity: 2 })]));

      await service.addItem('shop-1', 'sale-1', product);

      expect(setItemQuantity).toHaveBeenCalledWith('sale-1', 'line-1', 3, 0, 3000);
      expect(addItem).not.toHaveBeenCalled();
    });

    it('starts a line when the cart has nothing like it', async () => {
      const service = await load(sale([]));

      await service.addItem('shop-1', 'sale-1', product);

      expect(addItem).toHaveBeenCalled();
      expect(setItemQuantity).not.toHaveBeenCalled();
    });

    it('will not fold into a discounted line', async () => {
      // The discount is a fixed amount for the quantity it was given against; doubling the goods
      // underneath it would quietly halve it per unit.
      const service = await load(sale([line({ discountCents: 250 })]));

      await service.addItem('shop-1', 'sale-1', product);

      expect(addItem).toHaveBeenCalled();
      expect(setItemQuantity).not.toHaveBeenCalled();
    });

    it('will not fold into a line at a different price', async () => {
      // Merging rewrites the quantity and leaves the price alone, so the incoming item would
      // silently take on the existing line's.
      const service = await load(sale([line({ unitPriceCents: 1500 })]));

      await service.addItem('shop-1', 'sale-1', product);

      expect(addItem).toHaveBeenCalled();
    });

    it('keeps a product and a service apart even at the same price', async () => {
      const service = await load(sale([line({ kind: 'service', serviceId: 'svc-1', inventoryItemId: null })]));

      await service.addItem('shop-1', 'sale-1', product);

      expect(addItem).toHaveBeenCalled();
    });

    it('never folds a custom line, which is ad-hoc by definition', async () => {
      const service = await load(
        sale([line({ kind: 'custom', inventoryItemId: null, name: 'Diagnostic' })])
      );

      await service.addItem('shop-1', 'sale-1', {
        kind: 'custom',
        name: 'Diagnostic',
        unitPriceCents: 1000,
      });

      // Two charges that share a name and a price are not evidence they are the same charge.
      expect(addItem).toHaveBeenCalled();
      expect(setItemQuantity).not.toHaveBeenCalled();
    });
  });

  describe('changing a quantity directly', () => {
    it('recomputes tax for the new quantity', async () => {
      const service = await load(sale([line({ taxRateBps: 825 })]));
      resolveRateBps.mockResolvedValue(825);

      await service.setItemQuantity('shop-1', 'sale-1', 'line-1', 3);

      // 3 x $10.00 = $30.00, tax at 8.25% = $2.48, total $32.48. A line edited to three must be
      // taxed exactly as one rung up three times.
      expect(setItemQuantity).toHaveBeenCalledWith('sale-1', 'line-1', 3, 248, 3248);
    });

    it('removes the line when counted down to zero', async () => {
      const service = await load(sale([line({ quantity: 1 })]));

      await service.setItemQuantity('shop-1', 'sale-1', 'line-1', 0);

      expect(removeItem).toHaveBeenCalledWith('sale-1', 'line-1');
      expect(setItemQuantity).not.toHaveBeenCalled();
    });

    it('refuses a negative or fractional quantity', async () => {
      const service = await load(sale([line()]));

      await expect(
        service.setItemQuantity('shop-1', 'sale-1', 'line-1', -1)
      ).rejects.toThrow(/whole number/);
      await expect(
        service.setItemQuantity('shop-1', 'sale-1', 'line-1', 1.5)
      ).rejects.toThrow(/whole number/);
    });

    it('404s on a line that is not on this sale', async () => {
      const service = await load(sale([line()]));

      await expect(
        service.setItemQuantity('shop-1', 'sale-1', 'other-line', 2)
      ).rejects.toThrow(/Line not found/);
    });

    it('keeps a discount whole rather than scaling it with the quantity', async () => {
      const service = await load(sale([line({ discountCents: 250 })]));

      await service.setItemQuantity('shop-1', 'sale-1', 'line-1', 2);

      // 2 x $10.00 less the same $2.50 off the line, not $5.00.
      expect(setItemQuantity).toHaveBeenCalledWith('sale-1', 'line-1', 2, 0, 1750);
    });
  });
});
