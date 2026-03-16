const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to production database...');

  // Register migrations 072-087 as already applied
  for (let v = 72; v <= 87; v++) {
    await pool.query(
      'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [v, 'backfill_existing']
    );
  }
  console.log('Registered 072-087 as applied');

  // Run 088
  const m088 = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '088_add_waitlist_campaign_tracking.sql'),
    'utf8'
  );
  await pool.query(m088);
  await pool.query(
    'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [88, '088_add_waitlist_campaign_tracking']
  );
  console.log('Applied 088_add_waitlist_campaign_tracking');

  // Run 089
  const m089 = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '089_drop_waitlist_utm_columns.sql'),
    'utf8'
  );
  await pool.query(m089);
  await pool.query(
    'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [89, '089_drop_waitlist_utm_columns']
  );
  console.log('Applied 089_drop_waitlist_utm_columns');

  await pool.end();
  console.log('Done!');
}

run().catch(function(e) {
  console.error('Error:', e.message);
  process.exit(1);
});
