import { Router, Request, Response } from 'express';
import { getPosSaleService, assertSupportedTender } from '../../ShopDomain/services/PosSaleService';
import { logger } from '../../../utils/logger';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { warrantyRepository } from '../../../repositories';
import type { PosSaleStatus, PosTenderMethod } from '../../../repositories/PosSaleRepository';

const router = Router();

router.use(authMiddleware, requireRole(['shop']));

const fail = (res: Response, error: unknown, fallback: string) => {
  const status = (error as { status?: number })?.status;
  // 502 carries through as well: a receipt the mail provider refused is something the cashier can
  // retry, and swallowing it into a generic 500 loses the one detail that says so.
  if (status === 400 || status === 404 || status === 409 || status === 502) {
    return res.status(status).json({
      success: false,
      error: error instanceof Error ? error.message : fallback,
    });
  }
  return res.status(500).json({ success: false, error: fallback });
};

const shopIdOf = (req: Request): string | undefined => req.user?.shopId;

const handle = (
  fallback: string,
  work: (shopId: string, req: Request) => Promise<unknown>
) => async (req: Request, res: Response) => {
  const shopId = shopIdOf(req);
  if (!shopId) return res.status(401).json({ success: false, error: 'Shop authentication required' });

  try {
    return res.json({ success: true, data: await work(shopId, req) });
  } catch (error) {
    logger.error(fallback, {
      shopId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fail(res, error, fallback);
  }
};

router.post(
  '/pos/sales',
  handle('Failed to start a sale', (shopId, req) =>
    getPosSaleService().createSale(shopId, {
      locationId: req.body?.locationId,
      customerAddress: req.body?.customerAddress,
      staffMemberId: req.body?.staffMemberId,
      note: req.body?.note,
    })
  )
);

// `from` and `to` are full ISO timestamps, not calendar dates — the client resolves its own day
// boundaries, because no shop timezone is recorded to resolve them against here.
router.get(
  '/pos/sales',
  handle('Failed to list sales', (shopId, req) =>
    getPosSaleService().listSales(shopId, {
      status: typeof req.query.status === 'string' ? (req.query.status as PosSaleStatus) : undefined,
      locationId: typeof req.query.locationId === 'string' ? req.query.locationId : undefined,
      saleNumber: Number(req.query.saleNumber) || undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      limit: Number(req.query.limit) || undefined,
      offset: Number(req.query.offset) || undefined,
    })
  )
);

router.get(
  '/pos/reports/summary',
  handle('Failed to load POS summary', (shopId, req) =>
    getPosSaleService().getSummary(shopId, {
      days: Number(req.query.days) || undefined,
      locationId: typeof req.query.locationId === 'string' ? req.query.locationId : undefined,
    })
  )
);

// What this shop still owes this customer, for the conversation that starts "it's doing it again".
router.get(
  '/pos/warranties',
  handle('Failed to load warranties', (shopId, req) => {
    const customerAddress = String(req.query.customerAddress ?? '').trim();
    if (!customerAddress) {
      throw Object.assign(new Error('customerAddress is required.'), { status: 400 });
    }
    return warrantyRepository.listActiveForCustomer(shopId, customerAddress);
  })
);

router.get(
  '/pos/sales/:id',
  handle('Failed to load sale', (shopId, req) => getPosSaleService().getSale(shopId, req.params.id))
);

// Re-sends the emailed copy, to the address on the sale or a new one. The paper and on-screen
// copies need no endpoint — the register renders those from the sale it already has.
router.post(
  '/pos/sales/:id/receipt',
  handle('Failed to send the receipt', (shopId, req) =>
    getPosSaleService().resendReceipt(shopId, req.params.id, req.body?.email)
  )
);

// Refunds a completed sale across its tenders. Omit amountCents to give the whole thing back.
router.post(
  '/pos/sales/:id/refund',
  handle('Failed to refund the sale', (shopId, req) =>
    getPosSaleService().refundSale(shopId, req.params.id, {
      amountCents: req.body?.amountCents,
      reason: req.body?.reason,
      note: req.body?.note,
      restock: req.body?.restock === true,
      actorAddress: req.user?.address ?? null,
    })
  )
);

router.post(
  '/pos/sales/:id/items',
  handle('Failed to add line', (shopId, req) =>
    getPosSaleService().addItem(shopId, req.params.id, {
      kind: req.body?.kind,
      serviceId: req.body?.serviceId,
      inventoryItemId: req.body?.inventoryItemId,
      name: req.body?.name,
      quantity: req.body?.quantity,
      unitPriceCents: req.body?.unitPriceCents,
      discountCents: req.body?.discountCents,
    })
  )
);

router.put(
  '/pos/sales/:id/customer',
  handle('Failed to attach the customer', (shopId, req) =>
    getPosSaleService().setCustomer(shopId, req.params.id, String(req.body?.customerAddress ?? ''))
  )
);

router.delete(
  '/pos/sales/:id/customer',
  handle('Failed to remove the customer', (shopId, req) =>
    getPosSaleService().setCustomer(shopId, req.params.id, null)
  )
);

router.delete(
  '/pos/sales/:id/items/:itemId',
  handle('Failed to remove line', (shopId, req) =>
    getPosSaleService().removeItem(shopId, req.params.id, req.params.itemId)
  )
);

// Quantity 0 removes the line, so a stepper can count down to nothing without a second call.
router.patch(
  '/pos/sales/:id/items/:itemId',
  handle('Failed to change the quantity', (shopId, req) =>
    getPosSaleService().setItemQuantity(
      shopId,
      req.params.id,
      req.params.itemId,
      Number(req.body?.quantity)
    )
  )
);

router.post(
  '/pos/sales/:id/payments',
  handle('Failed to take payment', (shopId, req) => {
    const method = req.body?.method as PosTenderMethod;
    assertSupportedTender(method);

    const amountCents = Number(req.body?.amountCents);
    if (method === 'cash') {
      return getPosSaleService().takeCashPayment(
        shopId,
        req.params.id,
        amountCents,
        req.body?.tenderedCents !== undefined ? Number(req.body.tenderedCents) : undefined
      );
    }
    if (method === 'card') {
      const readerId = String(req.body?.readerId ?? '');
      if (!readerId) {
        throw Object.assign(new Error('readerId is required for a card payment.'), { status: 400 });
      }
      return getPosSaleService().startCardPayment(
        shopId,
        req.params.id,
        readerId,
        Number.isFinite(amountCents) && amountCents > 0 ? amountCents : undefined
      );
    }
    throw Object.assign(new Error(`Unsupported tender: ${method}`), { status: 400 });
  })
);

router.post(
  '/pos/sales/:id/payments/:paymentId/sync',
  handle('Failed to read payment status', (shopId, req) =>
    getPosSaleService().syncCardPayment(shopId, req.params.id, req.params.paymentId)
  )
);

router.post(
  '/pos/sales/:id/payments/:paymentId/cancel',
  handle('Failed to cancel payment', (shopId, req) =>
    getPosSaleService().cancelCardPayment(shopId, req.params.id, req.params.paymentId)
  )
);

router.post(
  '/pos/sales/:id/complete',
  handle('Failed to complete sale', (shopId, req) =>
    getPosSaleService().completeSale(shopId, req.params.id, {
      receiptEmail: req.body?.receiptEmail,
    })
  )
);

router.post(
  '/pos/sales/:id/void',
  handle('Failed to void sale', (shopId, req) =>
    getPosSaleService().voidSale(shopId, req.params.id, req.body?.reason)
  )
);

export default router;
