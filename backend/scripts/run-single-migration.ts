// Run a single migration file
// Usage: npx ts-node scripts/run-single-migration.ts migrations/046_create_review_helpful_votes.sql

import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx ts-node scripts/run-single-migration.ts <migration-file>');
  console.error('Example: npx ts-node scripts/run-single-migration.ts migrations/046_create_review_helpful_votes.sql');
  process.exit(1);
}

async function runMigration() {
  // Support both DATABASE_URL and individual DB_* variables
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      });

  try {
    console.log(`Reading migration file: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('Executing migration...');
    await pool.query(sql);

    console.log(`✅ Migration ${migrationFile} completed successfully!`);
  } catch (err: any) {
    console.error(`❌ Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
