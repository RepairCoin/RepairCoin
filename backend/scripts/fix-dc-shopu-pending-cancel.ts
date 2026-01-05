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

async function fix() {
  console.log('=== FIXING dc_shopu SUBSCRIPTION ===\n');

  // For a pending cancellation, the shop_subscriptions should be:
  // - status: 'active' (still active until period ends)
  // - is_active: true
  // - cancelled_at: NULL (not cancelled yet, just scheduled)
  // - cancellation_reason: keep for reference

  const updateResult = await pool.query(`
    UPDATE shop_subscriptions
    SET
      status = 'active',
      is_active = true,
      cancelled_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE shop_id = 'dc_shopu'
    RETURNING *
  `);

  if (updateResult.rows.length > 0) {
    const row = updateResult.rows[0];
    console.log('UPDATED shop_subscriptions:');
    console.log('  status:', row.status);
    console.log('  is_active:', row.is_active);
    console.log('  cancelled_at:', row.cancelled_at);
    console.log('  cancellation_reason:', row.cancellation_reason);
    console.log('  current_period_end:', row.current_period_end);
    console.log('\n✅ dc_shopu subscription data fixed!');
    console.log('\nNow the frontend should show "Reactivate" instead of "Resubscribe".');
  }

  await pool.end();
}

fix().catch(e => {
  console.error(e);
  pool.end();
});
