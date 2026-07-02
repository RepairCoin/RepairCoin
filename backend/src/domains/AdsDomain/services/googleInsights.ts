// backend/src/domains/AdsDomain/services/googleInsights.ts
//
// PURE mapping of Google Ads GAQL campaign-metrics rows → our daily spend/impressions/clicks
// (Slice 4). Leads/bookings/revenue are NOT taken from Google — they come from the lead→order
// pipeline roll-up (orthogonal columns). Side-effect-free so it's unit-testable.
//
// Google returns cost in MICROS of the account currency (1 unit = 1,000,000 micros), so
// cents = cost_micros / 10,000. The REST API returns camelCase (segments.date, metrics.costMicros).

export interface GoogleDailyInsight {
  date: string;       // YYYY-MM-DD (segments.date)
  spendCents: number;
  impressions: number;
  clicks: number;
}

/** Map GAQL rows (segmented by date) to our daily metrics. Tolerant of missing fields /
 *  string numerics. cost_micros → cents (÷10,000). */
export function mapGoogleInsights(rows: any[]): GoogleDailyInsight[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const date = r?.segments?.date;
      if (!date) return null;
      const m = r.metrics || {};
      const micros = parseInt(m.costMicros ?? '0', 10) || 0;
      return {
        date: String(date),
        spendCents: Math.round(micros / 10000),
        impressions: parseInt(m.impressions ?? '0', 10) || 0,
        clicks: parseInt(m.clicks ?? '0', 10) || 0,
      };
    })
    .filter((r): r is GoogleDailyInsight => r !== null);
}
