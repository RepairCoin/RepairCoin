// Script to update shops with NULL category to 'Repairs and Tech'
import { pool } from '../config/database-pool';

async function updateShopCategories() {
  console.log('🔄 Starting shop category update...\n');

  try {
    // First, check how many shops have NULL category
    const checkResult = await pool.query(
      'SELECT COUNT(*) as count FROM shops WHERE category IS NULL'
    );
    const nullCount = parseInt(checkResult.rows[0].count);

    console.log(`📊 Found ${nullCount} shops with NULL category`);

    if (nullCount === 0) {
      console.log('✅ All shops already have categories assigned!');
      process.exit(0);
    }

    // Show which shops will be updated
    const shopsToUpdate = await pool.query(
      'SELECT shop_id, name FROM shops WHERE category IS NULL LIMIT 10'
    );

    console.log('\n📋 Sample shops to be updated:');
    shopsToUpdate.rows.forEach(shop => {
      console.log(`   - ${shop.shop_id}: ${shop.name}`);
    });
    if (nullCount > 10) {
      console.log(`   ... and ${nullCount - 10} more`);
    }

    // Update all shops with NULL category to 'Repairs and Tech'
    const updateResult = await pool.query(
      `UPDATE shops
       SET category = 'Repairs and Tech'
       WHERE category IS NULL
       RETURNING shop_id, name, category`
    );

    console.log(`\n✅ Successfully updated ${updateResult.rows.length} shops to 'Repairs and Tech'`);

    // Verify the update
    const verifyResult = await pool.query(
      'SELECT COUNT(*) as count FROM shops WHERE category IS NULL'
    );
    const remainingNull = parseInt(verifyResult.rows[0].count);

    console.log(`\n📊 Verification: ${remainingNull} shops with NULL category remaining`);

    if (remainingNull === 0) {
      console.log('✅ All shops now have categories!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating shop categories:', error);
    process.exit(1);
  }
}

// Run the update
updateShopCategories();
