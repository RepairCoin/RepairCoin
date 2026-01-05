/**
 * Fix missing time slot config for Kyle's shop
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixKyleShopConfig() {
  const dbUrl = process.env.DATABASE_URL || '';
  const needsSsl = dbUrl.includes('sslmode=require') || dbUrl.includes('digitalocean');

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false
  });

  try {
    // Kyle's wallet address
    const walletAddress = '0xb3afc20c0f66e9ec902bd7df2313b57ae8fb1d81';
    
    // 1. Find shop by wallet
    const shopResult = await pool.query(
      `SELECT shop_id, name, wallet_address FROM shops WHERE LOWER(wallet_address) = LOWER($1)`,
      [walletAddress]
    );

    if (shopResult.rows.length === 0) {
      console.log('❌ Shop not found for wallet:', walletAddress);
      return;
    }

    const shop = shopResult.rows[0];
    console.log('✅ Found shop:', shop.name, '| ID:', shop.shop_id);
    
    // 2. Check if time slot config exists
    const configResult = await pool.query(
      `SELECT * FROM shop_time_slot_config WHERE shop_id = $1`,
      [shop.shop_id]
    );
    
    if (configResult.rows.length > 0) {
      console.log('✅ Time slot config already exists');
      console.log(configResult.rows[0]);
      return;
    }
    
    console.log('❌ No time slot config found - creating one...');
    
    // 3. Create default time slot config
    const insertResult = await pool.query(`
      INSERT INTO shop_time_slot_config (shop_id)
      VALUES ($1)
      RETURNING *
    `, [shop.shop_id]);
    
    console.log('✅ Created time slot config:', insertResult.rows[0]);
    
    // 4. Check shop_availability records
    const availResult = await pool.query(
      `SELECT * FROM shop_availability WHERE shop_id = $1 ORDER BY day_of_week`,
      [shop.shop_id]
    );
    
    if (availResult.rows.length === 0) {
      console.log('❌ No shop availability found - creating defaults...');
      
      // Create default availability (Mon-Fri 9-5)
      for (let day = 0; day <= 6; day++) {
        const isOpen = day >= 1 && day <= 5; // Mon-Fri
        await pool.query(`
          INSERT INTO shop_availability (shop_id, day_of_week, is_open, open_time, close_time)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (shop_id, day_of_week) DO NOTHING
        `, [
          shop.shop_id,
          day,
          isOpen,
          isOpen ? '09:00:00' : null,
          isOpen ? '18:00:00' : null
        ]);
      }
      console.log('✅ Created default availability (Mon-Fri 9am-6pm)');
    } else {
      console.log('✅ Shop availability exists:', availResult.rows.length, 'days configured');
    }
    
    console.log('\n✅ Done! Kyle\'s shop should now show Time Slot Configuration.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixKyleShopConfig();
