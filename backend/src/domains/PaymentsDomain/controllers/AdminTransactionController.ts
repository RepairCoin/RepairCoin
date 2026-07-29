// backend/src/domains/PaymentsDomain/controllers/AdminTransactionController.ts
//
// Platform-wide read side of the Payments Center (Slice A1). The mirror image of
// TransactionController: there the shopId comes from the JWT and can never be overridden;
// here there is no shop scope at all and `?shopId=` merely narrows the query.
//
// Read-only by design. Refunding from the admin side (A2) is deliberately not here — those are
// Connect direct charges, so it would debit a merchant's own balance, which is a policy
// decision before it is a code change.

import { Request, Response } from 'express';
import { paymentRepository, refundRepository } from '../../../repositories';
import type { PaymentWithContext } from '../../../repositories/PaymentRepository';
import { CSVExportService } from '../../../utils/csvExport';
import { logger } from '../../../utils/logger';
import { parseFilters } from './TransactionController';

const dollars = (cents: number) => (cents / 100).toFixed(2);

export const listAllTransactions = async (req: Request, res: Response) => {
  try {
    const parsed = parseFilters(req, { allowShopId: true });
    if ('error' in parsed) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);

    const result = await paymentRepository.listAll(parsed.filters, page, limit);
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error listing platform transactions:', error);
    return res.status(500).json({ success: false, error: 'Failed to list transactions' });
  }
};

export const getTransactionAdmin = async (req: Request, res: Response) => {
  try {
    const payment = await paymentRepository.getByIdAdmin(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('Error fetching platform transaction:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
};

/** Refund history for any payment. Read-only — issuing one is not an admin capability. */
export const listRefundsAdmin = async (req: Request, res: Response) => {
  try {
    const payment = await paymentRepository.getByIdAdmin(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    const refunds = await refundRepository.listByPayment(payment.id);
    return res.json({ success: true, data: refunds });
  } catch (error) {
    logger.error('Error listing platform refunds:', error);
    return res.status(500).json({ success: false, error: 'Failed to list refunds' });
  }
};

/**
 * Roll-up over the current filter set. `applicationFeeCents` is the platform's revenue from
 * payments — the number this whole slice exists to make visible.
 */
export const getTransactionTotals = async (req: Request, res: Response) => {
  try {
    const parsed = parseFilters(req, { allowShopId: true });
    if ('error' in parsed) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const totals = await paymentRepository.getTotals(parsed.filters);
    return res.json({ success: true, data: totals });
  } catch (error) {
    logger.error('Error computing platform payment totals:', error);
    return res.status(500).json({ success: false, error: 'Failed to compute totals' });
  }
};

export const exportAllTransactions = async (req: Request, res: Response) => {
  try {
    const parsed = parseFilters(req, { allowShopId: true });
    if ('error' in parsed) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const rows = await paymentRepository.listAllForExport(null, parsed.filters);

    // Same columns as the shop export, with Shop leading — a platform-wide file is unreadable
    // without knowing whose money each row is.
    const columns = [
      { key: 'shopName', label: 'Shop' },
      { key: 'shopId', label: 'Shop ID' },
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

    const filename = `transactions-platform-${new Date().toISOString().slice(0, 10)}.csv`;
    return CSVExportService.sendCSV(res, rows as unknown as PaymentWithContext[], columns, filename);
  } catch (error) {
    logger.error('Error exporting platform transactions:', error);
    return res.status(500).json({ success: false, error: 'Failed to export transactions' });
  }
};
