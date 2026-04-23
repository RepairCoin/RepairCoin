import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';

const dbHost = process.env.DB_HOST || '';
if (dbHost.toLowerCase().includes('prod')) {
  console.error('❌ Staging only.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  const c = await pool.connect();
  try {
    const cols = await c.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name='admins' ORDER BY ordinal_position`);
    console.log('=== admins columns ===');
    for (const r of cols.rows)
      console.log(
        `  ${r.column_name.padEnd(26)} ${r.data_type.padEnd(30)} null=${r.is_nullable}  default=${r.column_default || '(none)'}`
      );

    const sample = await c.query(`SELECT * FROM admins LIMIT 1`);
    console.log('\n=== Sample row ===');
    if (sample.rows[0])
      for (const [k, v] of Object.entries(sample.rows[0]))
        console.log(`  ${k.padEnd(26)} ${v === null ? '(null)' : v}`);

    const roles = await c.query(`SELECT DISTINCT role FROM admins`);
    console.log('\n=== Distinct roles ===');
    for (const r of roles.rows) console.log(`  ${r.role}`);

    const perms = await c.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='admins' AND column_name LIKE '%permission%'`);
    console.log('\n=== Permission-related columns ===');
    for (const r of perms.rows) console.log(`  ${r.column_name}`);
  } finally {
    c.release();
    await pool.end();
  }
})();
