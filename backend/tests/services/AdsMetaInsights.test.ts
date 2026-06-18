// Pure tests for the Phase-3 Meta insights mapper. The Graph fetch is exercised manually.

import { mapInsights } from '../../src/domains/AdsDomain/services/metaInsights';

describe('mapInsights', () => {
  it('maps daily rows; spend (currency) → cents, numerics from strings', () => {
    const rows = [
      { date_start: '2026-06-15', spend: '12.34', impressions: '1000', clicks: '42' },
      { date_start: '2026-06-16', spend: '0', impressions: '0', clicks: '0' },
    ];
    expect(mapInsights(rows)).toEqual([
      { date: '2026-06-15', spendCents: 1234, impressions: 1000, clicks: 42 },
      { date: '2026-06-16', spendCents: 0, impressions: 0, clicks: 0 },
    ]);
  });

  it('rounds fractional spend to the nearest cent', () => {
    expect(mapInsights([{ date_start: '2026-06-15', spend: '9.999' }])[0].spendCents).toBe(1000);
  });

  it('tolerates missing fields', () => {
    const r = mapInsights([{ date_start: '2026-06-15' }])[0];
    expect(r).toEqual({ date: '2026-06-15', spendCents: 0, impressions: 0, clicks: 0 });
  });

  it('skips rows without a date and non-arrays', () => {
    expect(mapInsights([{ spend: '5' }])).toEqual([]);
    expect(mapInsights(undefined as any)).toEqual([]);
    expect(mapInsights(null as any)).toEqual([]);
  });
});
