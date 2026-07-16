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
