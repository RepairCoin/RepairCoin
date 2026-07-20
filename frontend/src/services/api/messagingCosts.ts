// frontend/src/services/api/messagingCosts.ts
//
// Admin client for the off-channel AI-messaging cost + consent ledgers (Phase 3).
// The axios interceptor pre-unwraps response.data, so we unwrap the {success,data} envelope here.

import apiClient from './client';

export interface MessagingCostTotals {
  aiCostCents: number;
  carrierCostCents: number;
  totalCents: number;
  replyCount: number;
}

export interface ShopMessagingCostRow extends MessagingCostTotals {
  shopId: string;
  shopName: string | null;
}

export interface ConsentCount {
  channel: string;
  status: string;
  count: number;
}

export interface MessagingCostSummary {
  periodDays: number | null; // null = all-time
  grandTotal: MessagingCostTotals;
  shops: ShopMessagingCostRow[];
  consent: ConsentCount[];
}

const unwrap = <T>(res: any): T => (res.data.data ?? res.data) as T;

export const getMessagingCostSummary = async (days?: number): Promise<MessagingCostSummary> => {
  const res = await apiClient.get('/messages/admin/messaging-costs', {
    params: days ? { days } : {},
  });
  return unwrap<MessagingCostSummary>(res);
};

/** Cents (fractional allowed) → "$0.14". */
export const fmtCents = (cents: number): string => `$${((cents || 0) / 100).toFixed(2)}`;

// --- AI Usage Overage admin rollup (T3.2) ---

export interface OverageShopRow {
  shopId: string;
  shopName: string | null;
  overageCostCents: number;
  amountCents: number; // billable = cost × 3
  status: string;
}

export interface OveragePendingRow {
  shopId: string;
  shopName: string | null;
  amountCents: number; // billable pending across completed months
  monthCount: number;
}

export interface AdminOverageSummary {
  shops: OverageShopRow[];
  grandTotal: { overageCostCents: number; amountCents: number; shopCount: number };
  /** "Ready to invoice" — completed-month pending overage (what the invoice button acts on). */
  pending: { shops: OveragePendingRow[]; grandTotal: { amountCents: number; shopCount: number } };
  /** Whether Stripe charging is live (AI_OVERAGE_STRIPE_ENABLED). Gates the invoice buttons. */
  stripeEnabled: boolean;
}

/** Per-shop AI Usage Overage this month + grand total + ready-to-invoice rollup (admin). */
export const getAdminOverageSummary = async (): Promise<AdminOverageSummary> => {
  const res = await apiClient.get('/ai/admin/overage-summary');
  return unwrap<AdminOverageSummary>(res);
};

export interface InvoiceOverageResult {
  stripeInvoiceId?: string;
  totalCents?: number;
  status?: string;
  results?: Array<{ shopId: string; ok: boolean; error?: string }>;
}

/** Invoice a shop's pending overage (shopId), or every due shop (all:true). Admin, gated by
 *  AI_OVERAGE_STRIPE_ENABLED (501 when off). Throws with the server's status/message on failure. */
export const invoiceOveragePending = async (
  arg: { shopId: string } | { all: true }
): Promise<InvoiceOverageResult> => {
  const res = await apiClient.post('/ai/admin/overage-invoice', arg);
  return unwrap<InvoiceOverageResult>(res);
};
