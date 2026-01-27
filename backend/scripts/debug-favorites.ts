import 'dotenv/config';
import { getSharedPool } from '../src/utils/database-pool';

async function debug() {
  const pool = getSharedPool();

  try {
    // Check if service_favorites table exists and its structure
    console.log('=== SERVICE_FAVORITES TABLE STRUCTURE ===');
    const tableCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'service_favorites'
      ORDER BY ordinal_position
    `);

    if (tableCheck.rows.length === 0) {
      console.log('❌ Table service_favorites does NOT exist!');
      return;
    }

    console.log('Columns:');
    for (const col of tableCheck.rows) {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    }

    // Check constraints
    console.log('\n=== CONSTRAINTS ===');
    const constraints = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'service_favorites'::regclass
    `);

    for (const con of constraints.rows) {
      console.log(`  ${con.conname} (${con.contype}): ${con.definition}`);
    }

    // Check a sample service that exists
    console.log('\n=== SAMPLE SERVICES ===');
    const services = await pool.query(`
      SELECT service_id, service_name, shop_id
      FROM shop_services
      WHERE active = true
      LIMIT 3
    `);

    for (const svc of services.rows) {
      console.log(`  ${svc.service_id} | ${svc.service_name}`);
    }

    // Check a sample customer
    console.log('\n=== SAMPLE CUSTOMERS ===');
    const customers = await pool.query(`
      SELECT address, name
      FROM customers
      LIMIT 3
    `);

    for (const cust of customers.rows) {
      console.log(`  ${cust.address} | ${cust.name}`);
    }

    // Check existing favorites
    console.log('\n=== EXISTING FAVORITES ===');
    const favorites = await pool.query(`
      SELECT * FROM service_favorites LIMIT 5
    `);

    if (favorites.rows.length === 0) {
      console.log('  No favorites yet');
    } else {
      for (const fav of favorites.rows) {
        console.log(`  ${JSON.stringify(fav)}`);
      }
    }

    // Try to insert a test favorite
    console.log('\n=== TEST INSERT ===');
    const testCustomer = customers.rows[0]?.address;
    const testService = services.rows[0]?.service_id;

    if (testCustomer && testService) {
      console.log(`Attempting to insert: customer=${testCustomer}, service=${testService}`);

      try {
        const insertResult = await pool.query(`
          INSERT INTO service_favorites (customer_address, service_id)
          VALUES ($1, $2)
          ON CONFLICT (customer_address, service_id) DO NOTHING
          RETURNING *
        `, [testCustomer.toLowerCase(), testService]);

        console.log('Insert result:', insertResult.rows);
        console.log('Row count:', insertResult.rowCount);

        if (insertResult.rows.length === 0) {
          console.log('No rows returned - checking if already exists...');
          const existing = await pool.query(`
            SELECT * FROM service_favorites
            WHERE customer_address = $1 AND service_id = $2
          `, [testCustomer.toLowerCase(), testService]);
          console.log('Existing record:', existing.rows);
        }
      } catch (insertError: any) {
        console.log('❌ Insert failed:', insertError.message);
        console.log('Error details:', insertError);
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

debug();
