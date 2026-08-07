// frontend/src/services/api/payments.ts
//
// Client for the Payments Center (/api/payments). Launch scope is Transactions; refunds
// (Slice 1.3) and invoices/links/payouts (Phase 2) land here later.
//
// Money is INTEGER CENTS end to end — the ledger stores cents, this client passes cents
// through untouched, and only the display layer divides. Never round in transit.
//
// The axios interceptor pre-unwraps response.data, so call sites read res.data.<key>.

import apiClient from './client';

export type PaymentStatus =
  | 'requires_payment'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethod = 'card' | 'cash' | 'ach' | 'deposit' | 'terminal' | 'link';

export type PaymentSource =
  | 'booking'
  | 'invoice'
  | 'terminal'
  | 'link'
  | 'rcn_purchase'
  | 'deposit';

export interface Transaction {
  id: string;
  shopId: string;
  customerAddress: string | null;
  orderId: string | null;
  invoiceId: string | null;
  method: PaymentMethod;
  source: PaymentSource;
  grossCents: number;
  feeCents: number;
  applicationFeeCents: number;
  netCents: number;
  refundedCents: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeAccountId: string | null;
  capturedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Joined from the linked order — null when the payment never linked (see Slice 1.1).
  serviceName: string | null;
  customerName: string | null;
  orderStatus: string | null;
  completedByMemberId: string | null;
  // Counter sales have no single service to name them by — the receipt number and line count do.
  posSaleId: string | null;
  posSaleNumber: number | null;
  posItemCount: number | null;
}

/**
 * What to show where a service name goes. A counter sale is multi-line by definition, so it is
 * identified by its receipt number instead — joining a single service name would be a lie.
 */
export function describePayment(t: Transaction): string | null {
  if (!t.posSaleId) return t.serviceName;
  const number = t.posSaleNumber !== null ? ` #${t.posSaleNumber}` : "";
  const items = t.posItemCount
    ? ` · ${t.posItemCount} item${t.posItemCount === 1 ? "" : "s"}`
    : "";
  return `Counter sale${number}${items}`;
}

export interface TransactionPage {
  items: Transaction[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface TransactionQuery {
  status?: PaymentStatus;
  method?: PaymentMethod;
  customerAddress?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const getTransactions = async (query: TransactionQuery = {}): Promise<TransactionPage> => {
  const res = await apiClient.get<{ success: boolean; data: TransactionPage }>(
    `/payments/transactions${buildQuery({ ...query })}`
  );
  return res.data;
};

export const getTransaction = async (id: string): Promise<Transaction> => {
  const res = await apiClient.get<{ success: boolean; data: Transaction }>(
    `/payments/transactions/${id}`
  );
  return res.data;
};

export type RefundReason = 'requested_by_customer' | 'duplicate' | 'fraudulent';
export type RefundStatus = 'pending' | 'succeeded' | 'failed';
/** Who issued it. `createdBy` is a wallet address and can't tell the shop apart from FixFlow. */
export type RefundActor = 'shop' | 'admin';

export interface Refund {
  id: string;
  paymentId: string;
  shopId: string;
  amountCents: number;
  currency: string;
  reason: RefundReason;
  note: string | null;
  status: RefundStatus;
  stripeRefundId: string | null;
  createdBy: string | null;
  createdByRole: RefundActor;
  createdAt: string;
  updatedAt: string;
}

export const getRefunds = async (transactionId: string): Promise<Refund[]> => {
  const res = await apiClient.get<{ success: boolean; data: Refund[] }>(
    `/payments/transactions/${transactionId}/refunds`
  );
  return res.data;
};

/**
 * Issue a refund. Omit amountCents to refund the full remaining balance.
 *
 * The response reflects the refund ENTITY only — `payments.refunded_cents` and the payment's
 * status are updated by the charge.refunded webhook moments later, so the transaction row
 * should be refetched rather than patched optimistically.
 */
export const refundTransaction = async (
  transactionId: string,
  input: { amountCents?: number; reason?: RefundReason; note?: string } = {}
): Promise<Refund> => {
  const res = await apiClient.post<{ success: boolean; data: Refund }>(
    `/payments/transactions/${transactionId}/refund`,
    input
  );
  return res.data;
};

/**
 * Download the filtered transactions as CSV. Auth rides the httpOnly cookie, so this must go
 * through apiClient rather than a bare window.open — the interceptor returns the Blob itself.
 */
export const exportTransactionsCsv = async (
  query: Omit<TransactionQuery, 'page' | 'limit'> = {}
): Promise<Blob> => {
  const blob = await apiClient.get<Blob>(
    `/payments/transactions/export.csv${buildQuery({ ...query })}`,
    { responseType: 'blob' }
  );
  return blob as unknown as Blob;
};
