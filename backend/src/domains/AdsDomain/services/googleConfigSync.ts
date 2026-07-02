// backend/src/domains/AdsDomain/services/googleConfigSync.ts
//
// PURE helpers for two-way Google ⇄ app config sync (Slice 5). Side-effect-free so they're
// unit-testable without a DB/HTTP. Google is source-of-truth for a LIVE campaign's budget + status
// (mirrors the Meta D1 rule); pre-push drafts are skipped by the service (app is truth).

export interface ReconcileGoogleDbState { dailyBudgetCents: number; status: string; googleStatus: string | null; }
export interface ReconcileGoogleState { dailyBudgetCents: number | null; campaignStatus: string | null; }
export interface ReconcileGoogleChanges { dailyBudgetCents?: number; status?: string; googleStatus?: string; }

/** Google's campaign.status → our lowercase status. Returns null for states we don't map
 *  (UNKNOWN/UNSPECIFIED) so we leave our status untouched rather than guess. */
export function mapGoogleStatus(googleStatus: string | null | undefined): 'active' | 'paused' | 'archived' | null {
  switch ((googleStatus || '').toUpperCase()) {
    case 'ENABLED': return 'active';
    case 'PAUSED': return 'paused';
    case 'REMOVED': return 'archived';
    default: return null;
  }
}

/** A REMOVED campaign was deleted in Google Ads — treat as divergence (archived + halt), never recreate. */
export function isGoogleCampaignRemoved(googleStatus: string | null | undefined): boolean {
  return (googleStatus || '').toUpperCase() === 'REMOVED';
}

/** PURE: does a Google API error message indicate the campaign no longer exists (as opposed to a
 *  transient/permission error)? A REMOVED campaign is still returned by GAQL, so this covers the
 *  rarer hard-not-found. Used to treat it as divergence, not an error. */
export function isGoogleObjectGone(message: string | null | undefined): boolean {
  const m = (message || '').toLowerCase();
  return m.includes('not_found') || m.includes('does not exist') || m.includes('invalid') && m.includes('campaign');
}

/** PURE decision: given our DB state + Google's current state, what should change (Google wins for
 *  live). Returns only the fields that differ. */
export function reconcileGoogleFields(db: ReconcileGoogleDbState, g: ReconcileGoogleState): ReconcileGoogleChanges {
  const changes: ReconcileGoogleChanges = {};
  if (g.dailyBudgetCents != null && g.dailyBudgetCents !== db.dailyBudgetCents) {
    changes.dailyBudgetCents = g.dailyBudgetCents;
  }
  const mapped = mapGoogleStatus(g.campaignStatus);
  if (mapped && mapped !== db.status) changes.status = mapped;
  if (g.campaignStatus && g.campaignStatus !== db.googleStatus) changes.googleStatus = g.campaignStatus;
  return changes;
}
