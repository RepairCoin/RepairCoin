// frontend/src/services/api/adminPayments.ts
//
// Platform-wide client for the Payments Center (Slice A1) — the admin counterpart to
// api/payments.ts. Same ledger, no shop scope: `shopId` here is a filter, not a boundary.
//
// Read-only. There is no admin refund endpoint; issuing one from the platform side would debit
// a merchant's own Connect balance and is deliberately out of scope (Slice A2).
//
// Money is INTEGER CENTS end to end. The axios interceptor pre-unwraps response.data.

import apiClient from './client';
import type {
  PaymentMethod,
  PaymentStatus,
  Refund,
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
