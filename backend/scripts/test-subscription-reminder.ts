import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';
import { subscriptionReminderService } from '../src/services/SubscriptionReminderService';

const shopId = process.argv[2];
const days = parseInt(process.argv[3] || '1', 10);

async function testReminder() {
  try {
    // If shop ID provided, reset that specific shop first
    if (shopId) {
      console.log(`\n📋 Setting up ${shopId} to expire in ${days} day(s)...\n`);

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
        console.log(`❌ No active subscription found for shop: ${shopId}`);
        process.exit(1);
      }

      console.log('✅ Reset successful:', result.rows[0]);
    }

    // Run the reminder service
    console.log('\n📤 Running subscription reminder check...\n');
    const report = await subscriptionReminderService.processAllReminders();

    console.log('\n📊 Result:', JSON.stringify(report, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run test:subscription-reminder:shop -- [shop_id] [days]

Examples:
  npm run test:subscription-reminder:shop                    # Run for all shops
  npm run test:subscription-reminder:shop -- shop-3          # Reset shop-3 to 1 day, then run
  npm run test:subscription-reminder:shop -- shop-3 7        # Reset shop-3 to 7 days, then run
  npm run test:subscription-reminder:shop -- shop-3 3        # Reset shop-3 to 3 days, then run
  `);
  process.exit(0);
}

testReminder();
