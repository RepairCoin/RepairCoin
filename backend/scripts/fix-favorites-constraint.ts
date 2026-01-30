import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function fixConstraint() {
  const pool = getSharedPool();

  try {
    console.log('Adding unique constraint to service_favorites table...');

    // Add unique constraint on (customer_address, service_id)
    await pool.query(`
      ALTER TABLE service_favorites
      ADD CONSTRAINT service_favorites_customer_service_unique
      UNIQUE (customer_address, service_id)
    `);

    console.log('✅ Unique constraint added successfully!');

    // Verify the constraint was added
    const constraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'service_favorites'::regclass
    `);

    console.log('\nCurrent constraints:');
    for (const con of constraints.rows) {
      console.log(`  ${con.conname} (${con.contype}): ${con.definition}`);
    }

    // Test insert with ON CONFLICT
    console.log('\n=== TEST INSERT ===');
    const testResult = await pool.query(`
      INSERT INTO service_favorites (customer_address, service_id)
      VALUES ('test_address', 'test_service')
      ON CONFLICT (customer_address, service_id) DO NOTHING
      RETURNING *
    `);
    console.log('Test insert result:', testResult.rows);

    // Clean up test data
    await pool.query(`
      DELETE FROM service_favorites
      WHERE customer_address = 'test_address'
    `);
    console.log('Test data cleaned up');

    console.log('\n✅ Fix complete! The favorites feature should now work.');

  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('✅ Constraint already exists - no action needed');
    } else {
      console.error('❌ Error:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

fixConstraint();
