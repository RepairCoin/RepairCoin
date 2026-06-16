// Shared campaign-brief parse/validate — used by the opt-in (EnrollmentController) and
// recurring campaign requests (CampaignRequestController). Keeps validation in one place.

import { CampaignBrief } from '../repositories/EnrollmentRepository';

/** Validate + normalize a raw brief body. Returns { brief } or { error }. */
export function parseBrief(raw: any): { brief: CampaignBrief } | { error: string } {
  const b = raw ?? {};
  if (b.monthlyBudgetCents != null && (!Number.isFinite(b.monthlyBudgetCents) || b.monthlyBudgetCents < 0)) {
    return { error: 'brief.monthlyBudgetCents must be a non-negative number' };
  }
  if (b.targetRadiusMiles != null && (!Number.isInteger(b.targetRadiusMiles) || b.targetRadiusMiles < 1 || b.targetRadiusMiles > 100)) {
    return { error: 'brief.targetRadiusMiles must be an integer 1–100' };
  }
  if (b.goal != null && !['more_bookings', 'awareness', 'promote_service'].includes(b.goal)) {
    return { error: "brief.goal must be 'more_bookings', 'awareness' or 'promote_service'" };
  }
  return {
    brief: {
      promoteServiceIds: Array.isArray(b.promoteServiceIds) ? b.promoteServiceIds.map(String).slice(0, 20) : [],
      monthlyBudgetCents: b.monthlyBudgetCents ?? null,
      offer: b.offer ? String(b.offer).slice(0, 500) : null,
      targetRadiusMiles: b.targetRadiusMiles ?? null,
      goal: b.goal ?? null,
    },
  };
}
