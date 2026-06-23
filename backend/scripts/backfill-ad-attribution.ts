// backend/scripts/backfill-ad-attribution.ts
//
// One-time/batch Phase-4 backfill for ads conversion attribution: contact-match historical PAID
// orders (with no ad_lead_id) to recent ad leads, so the performance roll-up records their
// bookings/revenue. Reuses AdAttributionService.backfillUnattributed (the same matching as the
// live path). Idempotent + best-effort — safe to re-run.
//
// Requires ADS_CONVERSION_ATTRIBUTION=true (the feature flag). Reads DB_* from backend/.env.
//
// Usage:
//   npx ts-node scripts/backfill-ad-attribution.ts            # all ad-running shops, last 180d
//   npx ts-node scripts/backfill-ad-attribution.ts <shopId>   # one shop
//   npx ts-node scripts/backfill-ad-attribution.ts <shopId> <sinceDays> <limit>

import * as path from 'path';
// Load backend/.env explicitly (shell cwd can vary) so DB_* + the flag are present.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
import { getAdAttributionService, isConversionAttributionEnabled } from '../src/domains/AdsDomain/services/AdAttributionService';

async function main() {
  if (!isConversionAttributionEnabled()) {
    console.error('ADS_CONVERSION_ATTRIBUTION is not "true" — enable the flag before backfilling.');
    process.exit(1);
  }
  const shopId = process.argv[2] || undefined;
  const sinceDays = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
  const limit = process.argv[4] ? parseInt(process.argv[4], 10) : undefined;

  console.log('Backfilling ad attribution', { shopId: shopId ?? 'ALL ad-running shops', sinceDays: sinceDays ?? 180, limit: limit ?? 1000 });
  const result = await getAdAttributionService().backfillUnattributed({ shopId, sinceDays, limit });
  console.log(`Done — scanned ${result.scanned} unattributed paid order(s), linked ${result.linked}.`);
  process.exit(0);
}

main().catch((err) => { console.error('Backfill failed:', err); process.exit(1); });
