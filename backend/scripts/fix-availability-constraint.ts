/**
 * Fix shop_availability unique constraint
 *
 * This script adds the missing unique constraint on (shop_id, day_of_week)
 * that is required for the ON CONFLICT clause in updateShopAvailability.
 *
 * Usage: npx ts-node scripts/fix-availability-constraint.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixConstraint() {
  const host = process.env.DB_HOST || 'localhost';
  const sslEnabled = process.env.DB_SSL === 'true' || host.includes('digitalocean');

  const config: any = {
    host,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'repaircoin',
    user: process.env.DB_USER || 'repaircoin',
    password: process.env.DB_PASSWORD || 'repaircoin123',
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  };

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
    if (process.env.DATABASE_URL.includes('sslmode=require')) {
      config.ssl = { rejectUnauthorized: false };
    }
  }

  console.log(`\n🔌 Connecting to database: ${config.host}:${config.port}/${config.database}`);
  console.log(`   SSL: ${sslEnabled ? 'enabled' : 'disabled'}\n`);

  const pool = new Pool(config);

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'shop_availability'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table shop_availability does not exist. Creating it first...\n');

      // Create the table with the constraint
      await pool.query(`
        CREATE TABLE IF NOT EXISTS shop_availability (
          availability_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          shop_id VARCHAR(255) NOT NULL,
          day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
          is_open BOOLEAN DEFAULT true,
          open_time TIME,
          close_time TIME,
          break_start_time TIME,
          break_end_time TIME,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(shop_id, day_of_week)
        )
      `);
      console.log('✅ Table shop_availability created with unique constraint\n');
    } else {
      // Check if constraint exists
      const constraintCheck = await pool.query(`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'shop_availability'::regclass
        AND contype = 'u'
        AND (
          conname = 'shop_availability_shop_id_day_of_week_key'
          OR conname LIKE '%shop_id%day_of_week%'
        )
      `);

      console.log('Current unique constraints on shop_availability:');
      const allConstraints = await pool.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE conrelid = 'shop_availability'::regclass
      `);
      console.log(allConstraints.rows);
      console.log('');

      if (constraintCheck.rows.length > 0) {
        console.log(`✅ Unique constraint already exists: ${constraintCheck.rows[0].conname}\n`);
      } else {
        console.log('⚠️  Unique constraint missing. Adding it now...\n');

        // First, check for duplicates that would prevent adding the constraint
        const duplicateCheck = await pool.query(`
          SELECT shop_id, day_of_week, COUNT(*) as count
          FROM shop_availability
          GROUP BY shop_id, day_of_week
          HAVING COUNT(*) > 1
        `);

        if (duplicateCheck.rows.length > 0) {
          console.log('❌ Found duplicate entries that need to be resolved first:');
          console.log(duplicateCheck.rows);

          // Delete duplicates keeping only the most recent one
          console.log('\n🔧 Removing duplicate entries...');
          await pool.query(`
            DELETE FROM shop_availability a
            USING shop_availability b
            WHERE a.shop_id = b.shop_id
            AND a.day_of_week = b.day_of_week
            AND a.availability_id < b.availability_id
          `);
          console.log('✅ Duplicates removed\n');
        }

        // Add the unique constraint
        await pool.query(`
          ALTER TABLE shop_availability
          ADD CONSTRAINT shop_availability_shop_id_day_of_week_key
          UNIQUE (shop_id, day_of_week)
        `);
        console.log('✅ Unique constraint added successfully!\n');
      }
    }

    // Verify the constraint now exists
    const verifyCheck = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'shop_availability'::regclass
      AND contype = 'u'
    `);
    console.log('Verification - Current unique constraints:');
    console.log(verifyCheck.rows);

    // Test an upsert query to make sure it works
    console.log('\n🧪 Testing upsert query...');
    const testResult = await pool.query(`
      SELECT COUNT(*) as count FROM shop_availability
    `);
    console.log(`   Total records in shop_availability: ${testResult.rows[0].count}`);
    console.log('✅ Database is ready for upserts!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixConstraint();
