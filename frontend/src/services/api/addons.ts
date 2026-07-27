// Add-on hub status resolvers (Phase 1).
//
// The hub composes its per-shop view from EXISTING endpoints (no new backend in v1):
//   - AI Ads status  ← ads enrollment (getMyEnrollment)
//   - AI usage/allowance ← ai_shop_settings (getShopAiSettings)
// Add-ons whose backend isn't built yet resolve to 'coming_soon' (graceful degradation).

import apiClient from './client';
import { getMyEnrollment } from './ads';
import { agencyApi } from './agency';

export type AddonStatus = 'off' | 'pending' | 'active' | 'coming_soon';
export type AddonStatusMap = Record<string, AddonStatus>;

/** Resolve each registry add-on's status for the current shop. Best-effort:
 *  a failing/absent source leaves the add-on at its safe default. */
export async function resolveAddonStatuses(): Promise<AddonStatusMap> {
  const map: AddonStatusMap = {
    ai_ads: 'off',
    payments: 'coming_soon',   // until the Payments/Connect scope ships
    ai_overage: 'coming_soon', // until the AI-overage scope ships
    agency: 'off',             // activatable via in-hub checkout; resolved below
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

  // AI Usage Overage (T3.2): purely BACKEND-driven — /ai/spend reports `overageAvailable` at runtime
  // from ENABLE_AI_OVERAGE, so there's no build-time NEXT_PUBLIC flag (a Vercel env change alone would
  // never re-inline it → the old "still coming soon after setting the flag" trap). Stays 'coming_soon'
  // until the backend flag is on; active = opted in; off = available but not enabled.
  try {
    const ov = await getOverageState();
    if (ov.available) map.ai_overage = ov.enabled ? 'active' : 'off';
  } catch {
    // leave at 'coming_soon'
  }

  try {
    // GET /agency/me returns { agency: null } when the shop hasn't activated the add-on → 'off'.
    const me: any = await agencyApi.getMe();
    const st = me?.data?.agency?.status;
    map.agency =
      st === 'active' ? 'active' : st === 'pending' || st === 'past_due' ? 'pending' : 'off';
  } catch {
    // no agency for this shop → leave at 'off'
  }

  // Payments Processing ← Stripe Connect onboarding state (GET /shops/connect/summary).
  // 'active' once Stripe charges are enabled; otherwise 'off' (shows the Connect Stripe CTA).
  // A failed read leaves it at 'coming_soon'.
  const connect = await getConnectStatus();
  if (connect) map.payments = connect.chargesEnabled ? 'active' : 'off';

  return map;
}

/** Shop's Stripe Connect (payouts) status, from GET /shops/connect/summary (DB-only, no
 *  Stripe call). Returns null if unreadable so callers can keep a safe default. */
export async function getConnectStatus(): Promise<{ hasAccount: boolean; chargesEnabled: boolean } | null> {
  try {
    // apiClient unwraps to the response body: { success, data: { hasAccount, chargesEnabled } }.
    const body: any = await apiClient.get('/shops/connect/summary');
    const d = body?.data ?? {};
    return { hasAccount: !!d.hasAccount, chargesEnabled: !!d.chargesEnabled };
  } catch {
    return null;
  }
}

/** Per-shop AI Usage Overage state, read from GET /ai/spend. Best-effort (defaults to off/unavailable).
 *  `chargeUsd` = this month's accrued billable overage (Usage x3). `capUsd` = the shop's own bill-shock
 *  ceiling (null = inherit the platform default); `capDefaultUsd` = that platform default. */
export async function getOverageState(): Promise<{
  enabled: boolean;
  available: boolean;
  chargeUsd: number;
  capUsd: number | null;
  capDefaultUsd: number;
}> {
  try {
    const body: any = await apiClient.get('/ai/spend');
    const d = body?.data ?? body ?? {};
    return {
      enabled: !!d.overageEnabled,
      available: !!d.overageAvailable,
      chargeUsd: Number(d.overageChargeUsd) || 0,
      capUsd: d.overageCapUsd == null ? null : Number(d.overageCapUsd),
      capDefaultUsd: Number(d.overageCapDefaultUsd) || 100,
    };
  } catch {
    return { enabled: false, available: false, chargeUsd: 0, capUsd: null, capDefaultUsd: 100 };
  }
}

/** Enable/disable the AI Usage Overage add-on (POST /ai/overage). Enabling requires `consent:true`
 *  (acknowledgement of the Usage x3 terms); the backend rejects an enable without it. */
export async function setOverage(enabled: boolean, consent?: boolean): Promise<void> {
  await apiClient.post('/ai/overage', { enabled, consent });
}

/** Set the shop's per-shop bill-shock cap (POST /ai/overage/cap). Pass a positive number for a ceiling,
 *  or null to clear it and inherit the platform default. */
export async function setOverageCap(capUsd: number | null): Promise<void> {
  await apiClient.post('/ai/overage/cap', { capUsd });
}

export interface AiUsageSummary {
  budgetUsd: number;
  spentUsd: number;
  /** 0..1 */
  percentUsed: number;
}

/** AI allowance + usage for the YOUR PLAN section. Reads /ai/spend so the displayed allowance is the
 *  shop's TIER allowance ($10/$30/$75 via getShopAiBudget) — the same budget the enforcer uses — not the
 *  inert stored monthly_budget_usd (which drifted and showed a wrong allowance). Null if unreadable. */
export async function getAiUsageSummary(): Promise<AiUsageSummary | null> {
  try {
    const body: any = await apiClient.get('/ai/spend');
    const d = body?.data ?? body ?? {};
    const budgetUsd = Number(d.monthlyBudgetUsd) || 0;
    const spentUsd = Number(d.currentMonthSpendUsd) || 0;
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
