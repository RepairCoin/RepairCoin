import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function fixSubscription() {
  try {
    console.log('Fixing dc_shopu subscription...\n');

    // Update shop_subscriptions to match the new active stripe subscription
    const updateResult = await pool.query(`
      UPDATE shop_subscriptions
      SET
        status = 'active',
        is_active = true,
        cancelled_at = NULL,
        cancellation_reason = NULL,
        billing_reference = 'sub_1SWscNL8hwPnzzXkX4QQooOJ',
        current_period_end = '2026-01-30T14:29:28.167Z',
        next_payment_date = '2026-01-30T14:29:28.167Z',
        updated_at = CURRENT_TIMESTAMP
      WHERE shop_id = 'dc_shopu'
      RETURNING *
    `);

    if (updateResult.rows.length > 0) {
      const row = updateResult.rows[0];
      console.log('=== UPDATED SHOP SUBSCRIPTION ===');
      console.log(JSON.stringify({
        shopId: row.shop_id,
        status: row.status,
        isActive: row.is_active,
        billingReference: row.billing_reference,
        currentPeriodEnd: row.current_period_end,
        cancelledAt: row.cancelled_at
      }, null, 2));
      console.log('\n✅ Shop subscription fixed!');
    } else {
      console.log('No rows updated');
    }

    await pool.end();
  } catch (e) {
    console.error('Error:', e);
    await pool.end();
    process.exit(1);
  }
}

fixSubscription();
