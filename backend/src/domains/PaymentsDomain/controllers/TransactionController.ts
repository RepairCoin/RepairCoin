// backend/src/domains/PaymentsDomain/controllers/TransactionController.ts
//
// Read side of the Payments Center (Slice 1.2). Every handler is shop-scoped from the JWT —
// shopId is NEVER taken from a param or the body, so one shop can't read another's money.

import { Request, Response } from 'express';
import { paymentRepository } from '../../../repositories';
import type {
  ListPaymentsFilters,
  PaymentMethod,
  PaymentStatus,
  PaymentWithContext,
} from '../../../repositories/PaymentRepository';
import { CSVExportService } from '../../../utils/csvExport';
import { logger } from '../../../utils/logger';

const STATUSES: PaymentStatus[] = [
  'requires_payment', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded',
];
const METHODS: PaymentMethod[] = ['card', 'cash', 'ach', 'deposit', 'terminal', 'link'];

/** Parse + validate query filters. Unknown values are rejected rather than silently ignored. */
function parseFilters(req: Request): { filters: ListPaymentsFilters } | { error: string } {
  const { status, method, customerAddress, startDate, endDate } = req.query;
  const filters: ListPaymentsFilters = {};

  if (status) {
    if (!STATUSES.includes(status as PaymentStatus)) {
      return { error: `Invalid status. Expected one of: ${STATUSES.join(', ')}` };
    }
    filters.status = status as PaymentStatus;
  }
  if (method) {
    if (!METHODS.includes(method as PaymentMethod)) {
      return { error: `Invalid method. Expected one of: ${METHODS.join(', ')}` };
    }
    filters.method = method as PaymentMethod;
  }
  if (typeof customerAddress === 'string' && customerAddress) {
    filters.customerAddress = customerAddress;
  }
  for (const [key, value] of [['startDate', startDate], ['endDate', endDate]] as const) {
    if (value) {
      if (Number.isNaN(Date.parse(String(value)))) {
        return { error: `Invalid ${key}. Expected an ISO date.` };
      }
      filters[key] = String(value);
    }
  }

  return { filters };
}

/** Cents → a plain decimal string. CSV and JSON both expose cents; this is display only. */
const dollars = (cents: number) => (cents / 100).toFixed(2);

export const listTransactions = async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const parsed = parseFilters(req);
    if ('error' in parsed) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);

    const result = await paymentRepository.listByShop(shopId, parsed.filters, page, limit);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error listing transactions:', error);
    return res.status(500).json({ success: false, error: 'Failed to list transactions' });
  }
};

export const getTransaction = async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const payment = await paymentRepository.getByIdForShop(shopId, req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('Error fetching transaction:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
};

export const exportTransactions = async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const parsed = parseFilters(req);
    if ('error' in parsed) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const rows = await paymentRepository.listAllForExport(shopId, parsed.filters);

    // Money is exported in DOLLARS for spreadsheet use, but derived from the integer-cents
    // ledger so no rounding is introduced along the way.
    const columns = [
      { key: 'createdAt', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'method', label: 'Method' },
      { key: 'source', label: 'Source' },
      { key: 'customerName', label: 'Customer' },
      { key: 'customerAddress', label: 'Customer Wallet' },
      { key: 'serviceName', label: 'Service' },
      { key: 'orderId', label: 'Order' },
      { key: 'grossCents', label: 'Gross', format: (v: number) => dollars(v ?? 0) },
      { key: 'feeCents', label: 'Stripe Fee', format: (v: number) => dollars(v ?? 0) },
      { key: 'applicationFeeCents', label: 'Platform Fee', format: (v: number) => dollars(v ?? 0) },
      { key: 'netCents', label: 'Net', format: (v: number) => dollars(v ?? 0) },
      { key: 'refundedCents', label: 'Refunded', format: (v: number) => dollars(v ?? 0) },
      { key: 'currency', label: 'Currency' },
      { key: 'stripePaymentIntentId', label: 'Payment Intent' },
    ];

    const filename = `transactions-${shopId}-${new Date().toISOString().slice(0, 10)}.csv`;
    return CSVExportService.sendCSV(res, rows as unknown as PaymentWithContext[], columns, filename);
  } catch (error) {
    logger.error('Error exporting transactions:', error);
    return res.status(500).json({ success: false, error: 'Failed to export transactions' });
  }
};
