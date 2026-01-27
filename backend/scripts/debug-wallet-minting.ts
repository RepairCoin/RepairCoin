import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function debug() {
  const pool = getSharedPool();
  const customerAddress = '0x6F359646065e7FCFC4eB3cE4D108283268761063'.toLowerCase();

  try {
    console.log('=== INVESTIGATING WALLET MINTING ===');
    console.log('Customer Address:', customerAddress);
    console.log('');

    // Check ENABLE_BLOCKCHAIN_MINTING setting
    console.log('=== ENVIRONMENT SETTING ===');
    console.log('ENABLE_BLOCKCHAIN_MINTING:', process.env.ENABLE_BLOCKCHAIN_MINTING);
    console.log('');

    // Check system settings in database
    console.log('=== DATABASE SYSTEM SETTINGS ===');
    const settings = await pool.query(`
      SELECT setting_key, setting_value, last_modified, modified_by
      FROM system_settings
      WHERE setting_key = 'blockchain_minting_enabled'
    `);
    if (settings.rows.length > 0) {
      console.log('DB Setting:', settings.rows[0]);
    } else {
      console.log('No blockchain_minting_enabled setting in database');
    }
    console.log('');

    // Get all transactions for this customer
    console.log('=== ALL TRANSACTIONS FOR THIS CUSTOMER ===');
    const transactions = await pool.query(`
      SELECT
        id,
        type,
        amount,
        shop_id,
        transaction_hash,
        status,
        metadata,
        created_at
      FROM transactions
      WHERE customer_address = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [customerAddress]);

    for (const tx of transactions.rows) {
      console.log('---');
      console.log('ID:', tx.id);
      console.log('Type:', tx.type);
      console.log('Amount:', tx.amount);
      console.log('Shop:', tx.shop_id);
      console.log('Hash:', tx.transaction_hash);
      console.log('Status:', tx.status);
      console.log('Created:', tx.created_at);
      if (tx.metadata) {
        console.log('Metadata:', JSON.stringify(tx.metadata, null, 2));
      }
    }
    console.log('');

    // Check for recent "earn" type transactions (rewards)
    console.log('=== RECENT EARN TRANSACTIONS (REWARDS) ===');
    const earnTx = await pool.query(`
      SELECT
        id,
        amount,
        shop_id,
        transaction_hash,
        created_at,
        metadata
      FROM transactions
      WHERE customer_address = $1
        AND type = 'earn'
      ORDER BY created_at DESC
      LIMIT 5
    `, [customerAddress]);

    for (const tx of earnTx.rows) {
      console.log('---');
      console.log('Amount:', tx.amount, 'RCN');
      console.log('Shop:', tx.shop_id);
      console.log('Hash:', tx.transaction_hash);
      console.log('Time:', tx.created_at);

      // Check if hash starts with 'offchain_' (no blockchain) or is a real tx hash
      if (tx.transaction_hash?.startsWith('offchain_')) {
        console.log('>>> OFF-CHAIN ONLY (no blockchain minting)');
      } else if (tx.transaction_hash?.startsWith('0x')) {
        console.log('>>> ON-CHAIN TRANSACTION DETECTED!');
      }
    }
    console.log('');

    // Check customer balance
    console.log('=== CUSTOMER BALANCE ===');
    const customer = await pool.query(`
      SELECT
        address,
        name,
        tier,
        lifetime_earnings,
        is_active
      FROM customers
      WHERE address = $1
    `, [customerAddress]);

    if (customer.rows.length > 0) {
      console.log('Customer:', customer.rows[0]);
    }

    // Calculate balance from transactions
    console.log('');
    console.log('=== CALCULATED BALANCE FROM TRANSACTIONS ===');
    const balanceCalc = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('earn', 'referral_bonus', 'referee_bonus', 'tier_bonus', 'service_earning', 'transfer_in', 'service_redemption_refund') THEN amount ELSE 0 END), 0) as total_earned,
        COALESCE(SUM(CASE WHEN type IN ('redeem', 'service_redemption', 'transfer_out') THEN amount ELSE 0 END), 0) as total_redeemed,
        COALESCE(SUM(CASE WHEN type = 'mint_to_wallet' THEN amount ELSE 0 END), 0) as total_minted_to_wallet
      FROM transactions
      WHERE customer_address = $1
    `, [customerAddress]);

    const calc = balanceCalc.rows[0];
    console.log('Total Earned:', calc.total_earned);
    console.log('Total Redeemed:', calc.total_redeemed);
    console.log('Total Minted to Wallet:', calc.total_minted_to_wallet);
    console.log('Available Balance:', parseFloat(calc.total_earned) - parseFloat(calc.total_redeemed) - parseFloat(calc.total_minted_to_wallet));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debug();
