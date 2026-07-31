// frontend/src/services/api/adminPayments.ts
//
// Platform-wide client for the Payments Center (Slices A1 + A2) — the admin counterpart to
// api/payments.ts. Same ledger, no shop scope: `shopId` here is a filter, not a boundary.
//
// Read-only except for one call: refundAdminTransaction. That one debits the MERCHANT's own
// Connect balance, not the platform's — see the note on the function itself.
//
// Money is INTEGER CENTS end to end. The axios interceptor pre-unwraps response.data.

import apiClient from './client';
import type {
  PaymentMethod,
  PaymentStatus,
  Refund,
  RefundReason,
  Transaction,
} from './payments';

/** The platform list adds the shop's display name; everything else matches the shop view. */
export interface AdminTransaction extends Transaction {
  shopName: string | null;
}

export interface AdminTransactionPage {
  items: AdminTransaction[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface AdminTransactionQuery {
  shopId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  customerAddress?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Roll-up over the current filters. `applicationFeeCents` is the platform's own revenue from
 * payments. Totals are gross of refunds — `refundedCents` is reported alongside, not netted.
 */
export interface PaymentTotals {
  count: number;
  grossCents: number;
  feeCents: number;
  applicationFeeCents: number;
  netCents: number;
  refundedCents: number;
}

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const getAdminTransactions = async (
  query: AdminTransactionQuery = {}
): Promise<AdminTransactionPage> => {
  const res = await apiClient.get<{ success: boolean; data: AdminTransactionPage }>(
    `/payments/admin/transactions${buildQuery({ ...query })}`
  );
  return res.data;
};

export const getAdminTransaction = async (id: string): Promise<AdminTransaction> => {
  const res = await apiClient.get<{ success: boolean; data: AdminTransaction }>(
    `/payments/admin/transactions/${id}`
  );
  return res.data;
};

export const getAdminTransactionRefunds = async (id: string): Promise<Refund[]> => {
  const res = await apiClient.get<{ success: boolean; data: Refund[] }>(
    `/payments/admin/transactions/${id}/refunds`
  );
  return res.data;
};

export const getAdminTransactionTotals = async (
  query: Omit<AdminTransactionQuery, 'page' | 'limit'> = {}
): Promise<PaymentTotals> => {
  const res = await apiClient.get<{ success: boolean; data: PaymentTotals }>(
    `/payments/admin/transactions/summary${buildQuery({ ...query })}`
  );
  return res.data;
};

/**
 * Issue a refund on any shop's payment (Slice A2). Omit amountCents to refund the full
 * remaining balance.
 *
 * This is NOT the platform refunding its own money: these are Connect direct charges, so the
 * money comes out of the shop's Stripe balance and our commission is clawed back with it. The
 * note is mandatory — the shop is notified and reads it. Scope to disputes and fraud.
 *
 * As on the shop side, the response is the refund ENTITY only; `refundedCents` and the payment
 * status arrive via the charge.refunded webhook, so refetch rather than patching optimistically.
 */
export const refundAdminTransaction = async (
  transactionId: string,
  input: { amountCents?: number; reason?: RefundReason; note: string }
): Promise<Refund> => {
  const res = await apiClient.post<{ success: boolean; data: Refund }>(
    `/payments/admin/transactions/${transactionId}/refund`,
    input
  );
  return res.data;
};

/**
 * Auth rides the httpOnly cookie, so this must go through apiClient rather than window.open —
 * the interceptor returns the Blob itself.
 */
export const exportAdminTransactionsCsv = async (
  query: Omit<AdminTransactionQuery, 'page' | 'limit'> = {}
): Promise<Blob> => {
  const blob = await apiClient.get<Blob>(
    `/payments/admin/transactions/export.csv${buildQuery({ ...query })}`,
    { responseType: 'blob' }
  );
  return blob as unknown as Blob;
};
