// Add-on hub status resolvers (Phase 1).
//
// The hub composes its per-shop view from EXISTING endpoints (no new backend in v1):
//   - AI Ads status  ← ads enrollment (getMyEnrollment)
//   - AI usage/allowance ← ai_shop_settings (getShopAiSettings)
// Add-ons whose backend isn't built yet resolve to 'coming_soon' (graceful degradation).

import apiClient from './client';
import { getMyEnrollment } from './ads';
import { getShopAiSettings } from './aiSettings';

export type AddonStatus = 'off' | 'pending' | 'active' | 'coming_soon';
export type AddonStatusMap = Record<string, AddonStatus>;

/** Resolve each registry add-on's status for the current shop. Best-effort:
 *  a failing/absent source leaves the add-on at its safe default. */
export async function resolveAddonStatuses(): Promise<AddonStatusMap> {
  const map: AddonStatusMap = {
    ai_ads: 'off',
    payments: 'coming_soon',   // until the Payments/Connect scope ships
    ai_overage: 'coming_soon', // until the AI-overage scope ships
    agency: 'coming_soon',     // until the Agency scope ships
  };

  try {
    const enr = await getMyEnrollment();
    if (enr) {
      map.ai_ads =
        enr.status === 'approved' ? 'active' : enr.status === 'pending' ? 'pending' : 'off';
    }
  } catch {
    // leave ai_ads at 'off' — ads not enrolled / endpoint unavailable
  }

  // AI Usage Overage (T3.2 Slice 1): resolve the real per-shop state when the feature is live.
  // Stays 'coming_soon' until NEXT_PUBLIC_AI_OVERAGE_ENABLED is on AND the backend reports it available
  // (ENABLE_AI_OVERAGE). active = opted in; off = available but not enabled.
  if (process.env.NEXT_PUBLIC_AI_OVERAGE_ENABLED === 'true') {
    try {
      const ov = await getOverageState();
      if (ov.available) map.ai_overage = ov.enabled ? 'active' : 'off';
    } catch {
      // leave at 'coming_soon'
    }
  }

  return map;
}

/** Per-shop AI Usage Overage state, read from GET /ai/spend. Best-effort (defaults to off/unavailable). */
export async function getOverageState(): Promise<{ enabled: boolean; available: boolean }> {
  try {
    const body: any = await apiClient.get('/ai/spend');
    const d = body?.data ?? body ?? {};
    return { enabled: !!d.overageEnabled, available: !!d.overageAvailable };
  } catch {
    return { enabled: false, available: false };
  }
}

/** Enable/disable the AI Usage Overage add-on for the current shop (POST /ai/overage). */
export async function setOverage(enabled: boolean): Promise<void> {
  await apiClient.post('/ai/overage', { enabled });
}

export interface AiUsageSummary {
  budgetUsd: number;
  spentUsd: number;
  /** 0..1 */
  percentUsed: number;
}

/** AI allowance + usage for the YOUR PLAN section. Null if settings can't be read. */
export async function getAiUsageSummary(): Promise<AiUsageSummary | null> {
  try {
    const s = await getShopAiSettings();
    const budgetUsd = s.monthlyBudgetUsd || 0;
    const spentUsd = s.currentMonthSpendUsd || 0;
    return { budgetUsd, spentUsd, percentUsed: budgetUsd > 0 ? spentUsd / budgetUsd : 0 };
  } catch {
    return null;
  }
}

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
}

/** Default/first saved card for the BILLING section. Null if none on file or unreadable.
 *  GET /shops/payment-methods → { paymentMethods: [{ card: { brand, last4, ... } }] }
 *  (apiClient's response interceptor already returns the response body). */
export async function getPaymentMethod(): Promise<PaymentMethodSummary | null> {
  try {
    const body: any = await apiClient.get('/shops/payment-methods');
    const list: any[] = body?.paymentMethods ?? body?.data?.paymentMethods ?? [];
    const card = list.find((p) => p?.card)?.card;
    if (!card) return null;
    return { brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear };
  } catch {
    return null;
  }
}
