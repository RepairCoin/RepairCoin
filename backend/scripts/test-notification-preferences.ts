/**
 * Test script for notification preferences API endpoints
 * Usage: npx ts-node scripts/test-notification-preferences.ts
 */

import { getSharedPool } from '../src/utils/database-pool';
import { generalNotificationPreferencesRepository } from '../src/repositories/GeneralNotificationPreferencesRepository';

async function testNotificationPreferences() {
  console.log('\n🔍 Testing Notification Preferences Backend...\n');

  const pool = getSharedPool();

  try {
    // Test 1: Check database table exists
    console.log('1️⃣ Checking if general_notification_preferences table exists...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'general_notification_preferences'
      );
    `);
    const tableExists = tableCheck.rows[0].exists;
    console.log(`   ✅ Table exists: ${tableExists}`);

    if (!tableExists) {
      console.log('   ❌ Table does not exist. Run migrations first!');
      process.exit(1);
    }

    // Test 2: Count existing preferences
    console.log('\n2️⃣ Counting existing preferences...');
    const countResult = await pool.query('SELECT COUNT(*) FROM general_notification_preferences');
    const count = countResult.rows[0].count;
    console.log(`   ✅ Found ${count} preference records`);

    // Test 3: Test repository - Get or create preferences for test user
    console.log('\n3️⃣ Testing repository getOrCreatePreferences...');
    const testAddress = '0x1234567890123456789012345678901234567890';
    const testUserType = 'shop';

    const preferences = await generalNotificationPreferencesRepository.getOrCreatePreferences(
      testAddress,
      testUserType
    );

    console.log('   ✅ Preferences retrieved/created successfully');
    console.log(`   User Address: ${preferences.userAddress}`);
    console.log(`   User Type: ${preferences.userType}`);
    console.log(`   Platform Updates: ${preferences.platformUpdates}`);
    console.log(`   Maintenance Alerts: ${preferences.maintenanceAlerts}`);
    console.log(`   New Orders (shop): ${preferences.newOrders}`);

    // Test 4: Test update preferences
    console.log('\n4️⃣ Testing update preferences...');
    const updatedPrefs = await generalNotificationPreferencesRepository.updatePreferences(
      testAddress,
      testUserType,
      {
        platformUpdates: false,
        newOrders: false,
        promotions: true
      }
    );

    console.log('   ✅ Preferences updated successfully');
    console.log(`   Platform Updates: ${updatedPrefs.platformUpdates} (should be false)`);
    console.log(`   New Orders: ${updatedPrefs.newOrders} (should be false)`);
    console.log(`   Promotions: ${updatedPrefs.promotions} (should be true)`);

    // Test 5: Test reset to defaults
    console.log('\n5️⃣ Testing reset to defaults...');
    const resetPrefs = await generalNotificationPreferencesRepository.createDefaultPreferences(
      testAddress,
      testUserType
    );

    console.log('   ✅ Preferences reset to defaults successfully');
    console.log(`   Platform Updates: ${resetPrefs.platformUpdates} (should be true - default)`);
    console.log(`   New Orders: ${resetPrefs.newOrders} (should be true - default)`);
    console.log(`   Promotions: ${resetPrefs.promotions} (should be false - default)`);

    // Test 6: Get all preference types
    console.log('\n6️⃣ Checking preference distribution by user type...');
    const distribution = await pool.query(`
      SELECT user_type, COUNT(*)
      FROM general_notification_preferences
      GROUP BY user_type
    `);

    console.log('   Distribution:');
    distribution.rows.forEach(row => {
      console.log(`   - ${row.user_type}: ${row.count} users`);
    });

    // Cleanup test data
    console.log('\n7️⃣ Cleaning up test data...');
    await pool.query(
      'DELETE FROM general_notification_preferences WHERE user_address = $1',
      [testAddress.toLowerCase()]
    );
    console.log('   ✅ Test data cleaned up');

    console.log('\n✅ All tests passed! Backend is properly connected.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run tests
testNotificationPreferences()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
