// Add-on hub status resolvers (Phase 1).
//
// The hub composes its per-shop view from EXISTING endpoints (no new backend in v1):
//   - AI Ads status  ← ads enrollment (getMyEnrollment)
//   - AI usage/allowance ← ai_shop_settings (getShopAiSettings)
// Add-ons whose backend isn't built yet resolve to 'coming_soon' (graceful degradation).

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

  return map;
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
