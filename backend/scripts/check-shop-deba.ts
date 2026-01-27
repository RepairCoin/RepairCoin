import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function check() {
  const pool = getSharedPool();

  try {
    // Check for shop with code 'deba'
    const shopResult = await pool.query(`
      SELECT shop_id, name, shop_code, owner_address, subscription_status, is_active
      FROM shops
      WHERE shop_code ILIKE '%deba%' OR name ILIKE '%deba%'
    `);

    console.log('=== Shops matching "deba" ===');
    if (shopResult.rows.length === 0) {
      console.log('No shops found with code or name containing "deba"');
    } else {
      for (const shop of shopResult.rows) {
        console.log(`ID: ${shop.shop_id}`);
        console.log(`Name: ${shop.name}`);
        console.log(`Shop Code: ${shop.shop_code}`);
        console.log(`Owner: ${shop.owner_address}`);
        console.log(`Subscription: ${shop.subscription_status}`);
        console.log(`Active: ${shop.is_active}`);
        console.log('---');
      }
    }

    // List all shop codes for reference
    console.log('\n=== All Shop Codes ===');
    const allShops = await pool.query(`
      SELECT shop_code, name, subscription_status, is_active
      FROM shops
      ORDER BY name
    `);
    for (const shop of allShops.rows) {
      console.log(`${shop.shop_code} | ${shop.name} | sub: ${shop.subscription_status} | active: ${shop.is_active}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
