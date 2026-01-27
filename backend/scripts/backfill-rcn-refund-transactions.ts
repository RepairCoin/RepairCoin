// Backfill script to add missing refund transactions for cancelled orders
// This fixes the balance calculation issue where refunds weren't recorded as transactions
import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function backfillRefundTransactions() {
  const pool = getSharedPool();

  try {
    console.log('\n=== Backfilling Missing RCN Refund Transactions ===\n');

    // Find cancelled orders with RCN redeemed that don't have a corresponding refund transaction
    const ordersResult = await pool.query(`
      SELECT
        so.order_id,
        so.customer_address,
        so.shop_id,
        so.rcn_redeemed,
        so.cancellation_reason,
        so.updated_at as cancelled_at
      FROM service_orders so
      WHERE so.status = 'cancelled'
        AND so.rcn_redeemed > 0
        AND NOT EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.customer_address = so.customer_address
            AND t.type = 'service_redemption_refund'
            AND t.metadata->>'orderId' = so.order_id
        )
      ORDER BY so.updated_at DESC
    `);

    console.log(`Found ${ordersResult.rows.length} cancelled orders with RCN that need refund transactions\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const order of ordersResult.rows) {
      console.log(`Processing order: ${order.order_id}`);
      console.log(`  Customer: ${order.customer_address}`);
      console.log(`  RCN to refund: ${order.rcn_redeemed}`);

      try {
        // Insert the refund transaction
        await pool.query(`
          INSERT INTO transactions (
            type,
            customer_address,
            shop_id,
            amount,
            reason,
            timestamp,
            status,
            metadata
          ) VALUES (
            'service_redemption_refund',
            $1,
            $2,
            $3,
            $4,
            $5,
            'completed',
            $6
          )
        `, [
          order.customer_address,
          order.shop_id,
          order.rcn_redeemed,
          `RCN refund for cancelled order ${order.order_id} (backfill)`,
          order.cancelled_at || new Date().toISOString(),
          JSON.stringify({
            orderId: order.order_id,
            cancellationReason: order.cancellation_reason,
            originalRedemptionAmount: parseFloat(order.rcn_redeemed),
            source: 'backfill_script',
            backfilledAt: new Date().toISOString()
          })
        ]);

        console.log(`  ✓ Refund transaction created\n`);
        successCount++;
      } catch (err) {
        console.log(`  ✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}\n`);
        errorCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    // Verify the fix for "Qua Ting" specifically
    console.log('\n=== Verifying Qua Ting Balance ===\n');

    const customerResult = await pool.query(`
      SELECT
        c.address,
        c.name,
        c.current_rcn_balance,
        c.lifetime_earnings,
        c.total_redemptions
      FROM customers c
      WHERE c.name ILIKE '%qua%' AND c.name ILIKE '%ting%'
    `);

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
      console.log(`Customer: ${customer.name}`);
      console.log(`  Address: ${customer.address}`);
      console.log(`  DB Balance: ${customer.current_rcn_balance}`);
      console.log(`  Lifetime Earnings: ${customer.lifetime_earnings}`);
      console.log(`  Total Redemptions (DB): ${customer.total_redemptions}`);

      // Calculate balance using transaction totals
      const totalsResult = await pool.query(`
        SELECT
          COALESCE(SUM(CASE
            WHEN type IN ('redeem', 'service_redemption') THEN amount
            WHEN type = 'service_redemption_refund' THEN -amount
            ELSE 0
          END), 0) as total_redeemed,
          COALESCE(SUM(CASE WHEN type = 'mint' AND (
            metadata->>'mintType' = 'instant_mint' OR
            metadata->>'source' = 'customer_dashboard'
          ) THEN amount ELSE 0 END), 0) as total_minted_to_wallet
        FROM transactions
        WHERE customer_address = $1
      `, [customer.address]);

      const totals = totalsResult.rows[0];
      const availableBalance = Math.max(0,
        parseFloat(customer.lifetime_earnings) -
        parseFloat(totals.total_redeemed) -
        parseFloat(totals.total_minted_to_wallet)
      );

      console.log(`\n  Calculated from transactions:`);
      console.log(`    Total Redeemed (net): ${totals.total_redeemed}`);
      console.log(`    Total Minted to Wallet: ${totals.total_minted_to_wallet}`);
      console.log(`    Available Balance: ${availableBalance}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

backfillRefundTransactions();
