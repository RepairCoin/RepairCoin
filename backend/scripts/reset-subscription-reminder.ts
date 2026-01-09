import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

const shopId = process.argv[2] || 'shop-3';
const days = parseInt(process.argv[3] || '1', 10);

async function resetReminder() {
  try {
    const result = await getSharedPool().query(
      `UPDATE stripe_subscriptions
       SET reminder_7d_sent = false,
           reminder_3d_sent = false,
           reminder_1d_sent = false,
           current_period_end = NOW() + INTERVAL '${days} days'
       WHERE shop_id = $1 AND status = 'active'
       RETURNING shop_id, current_period_end, status`,
      [shopId]
    );

    if (result.rows.length === 0) {
      console.log(`No active subscription found for shop: ${shopId}`);
    } else {
      console.log('Reset successful:', result.rows[0]);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetReminder();
