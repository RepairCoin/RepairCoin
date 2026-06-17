// backend/src/domains/AdsDomain/services/metaInsights.ts
//
// PURE mapping of Meta /insights rows → our daily spend/impressions/clicks (Phase 3).
// Leads/bookings/revenue are NOT taken from Meta — they come from the lead→order pipeline
// roll-up (orthogonal columns). Side-effect-free so it's unit-testable.

export interface MetaDailyInsight {
  date: string;       // YYYY-MM-DD (Meta date_start)
  spendCents: number;
  impressions: number;
  clicks: number;
}

/** Map Meta insights `data` rows (time_increment=1) to our daily metrics. Tolerant of
 *  missing fields / string numerics. Spend is a decimal in account currency → cents. */
export function mapInsights(rows: any[]): MetaDailyInsight[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r?.date_start)
    .map((r) => ({
      date: String(r.date_start),
      spendCents: Math.round((parseFloat(r.spend ?? '0') || 0) * 100),
      impressions: parseInt(r.impressions ?? '0', 10) || 0,
      clicks: parseInt(r.clicks ?? '0', 10) || 0,
    }));
}
