// One-time backfill: complete referrals that got stuck `pending` because the
// referee completed their first repair through the service-marketplace flow,
// which (before the TokenService fix) never called completeReferralOnFirstRepair.
//
// Usage:
//   npx ts-node src/scripts/backfill-pending-referrals.ts            # dry-run (default, no writes)
//   npx ts-node src/scripts/backfill-pending-referrals.ts --apply    # live run
//
// Idempotent: completeReferralOnFirstRepair only acts on `pending` referrals,
// so re-running never double-pays.
import { getSharedPool } from '../utils/database-pool';
import { ReferralService } from '../services/ReferralService';

interface Candidate {
  id: number;
  referee_address: string;
  referrer_address: string;
  shop_id: string;
  repair_amount: number;
  first_completed_order: string;
}

async function backfillPendingReferrals() {
  const apply = process.argv.includes('--apply');
  console.log(`🔄 Backfill pending referrals — mode: ${apply ? 'LIVE (--apply)' : 'DRY RUN'}\n`);

  const pool = getSharedPool();
  const referralService = new ReferralService();

  try {
    // Candidates: pending referrals whose referee has at least one completed
    // service_order. We pull the referee's earliest completed order to use as
    // the trigger-equivalent (its shop_id + total_amount drive the bonus call).
    const { rows } = await pool.query<Candidate>(`
      SELECT r.id,
             r.referee_address,
             r.referrer_address,
             fo.shop_id,
             fo.total_amount AS repair_amount,
             fo.created_at   AS first_completed_order
      FROM referrals r
      JOIN LATERAL (
        SELECT so.shop_id, so.total_amount, so.created_at
        FROM service_orders so
        WHERE LOWER(so.customer_address) = LOWER(r.referee_address)
          AND so.status = 'completed'
        ORDER BY so.created_at ASC
        LIMIT 1
      ) fo ON TRUE
      WHERE r.status = 'pending'
        AND r.metadata->>'awaitingFirstRepair' = 'true'
      ORDER BY r.id ASC
    `);

    console.log(`📊 Found ${rows.length} stuck referral(s) eligible for completion\n`);

    if (rows.length === 0) {
      console.log('✅ Nothing to backfill.');
      process.exit(0);
    }

    let completed = 0;
    let skipped = 0;
    let failed = 0;

    for (const c of rows) {
      const label = `referral id=${c.id} (referee ${c.referee_address} ← referrer ${c.referrer_address}), shop=${c.shop_id}, $${c.repair_amount}`;

      if (!apply) {
        console.log(`   [dry-run] would complete ${label}`);
        continue;
      }

      try {
        const result = await referralService.completeReferralOnFirstRepair(
          c.referee_address,
          c.shop_id,
          Number(c.repair_amount)
        );
        if (result.referralCompleted) {
          completed++;
          console.log(`   ✅ completed ${label}`);
        } else {
          skipped++;
          console.log(`   ⏭️  skipped ${label} — ${result.message}`);
        }
      } catch (err: any) {
        failed++;
        console.error(`   ❌ failed ${label} — ${err.message}`);
      }
    }

    if (apply) {
      console.log(`\n📊 Done: ${completed} completed, ${skipped} skipped, ${failed} failed`);
    } else {
      console.log(`\nℹ️  Dry run complete. Re-run with --apply to distribute bonuses.`);
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error during referral backfill:', error);
    process.exit(1);
  }
}

backfillPendingReferrals();
