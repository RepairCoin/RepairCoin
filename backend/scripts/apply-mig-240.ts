import * as path from 'path'; import * as fs from 'fs'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT||'5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '240_create_ai_usage_events_view.sql'), 'utf8');
  await pool.query(sql);
  await pool.query(`INSERT INTO schema_migrations (version, name) VALUES (240, '240_create_ai_usage_events_view') ON CONFLICT (version) DO NOTHING`);

  const t = await pool.query(`SELECT to_regclass('ai_misc_usage') AS t, to_regclass('ai_usage_events') AS v`);
  console.log('ai_misc_usage:', t.rows[0].t, '| ai_usage_events:', t.rows[0].v);

  console.log('\n=== view: MTD cost by feature ===');
  const byFeature = await pool.query(
    `SELECT feature, vendor, COUNT(*)::int AS n, SUM(cost_usd)::float AS c
       FROM ai_usage_events
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      GROUP BY feature, vendor ORDER BY SUM(cost_usd) DESC`);
  let total = 0;
  for (const r of byFeature.rows) { total += r.c; console.log(`${r.feature.padEnd(16)} ${r.vendor.padEnd(11)} $${r.c.toFixed(4).padStart(9)}  (${r.n} rows)`); }
  console.log(`${'TOTAL (all COGS)'.padEnd(28)} $${total.toFixed(4).padStart(9)}`);

  const billable = await pool.query(
    `SELECT SUM(cost_usd)::float AS c FROM ai_usage_events
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()) AND billable_to_shop`);
  console.log(`${'TOTAL (billable to shops)'.padEnd(28)} $${billable.rows[0].c.toFixed(4).padStart(9)}`);

  console.log('\n=== view-derived vs counter, per shop (MTD, billable only) ===');
  const cmp = await pool.query(`
    WITH d AS (
      SELECT shop_id, SUM(cost_usd)::float AS c FROM ai_usage_events
       WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()) AND billable_to_shop
       GROUP BY shop_id
    )
    SELECT s.shop_id, COALESCE(d.c,0)::float AS derived, s.current_month_spend_usd::float AS counter
      FROM ai_shop_settings s LEFT JOIN d ON d.shop_id = s.shop_id
     WHERE COALESCE(d.c,0) > 0 OR s.current_month_spend_usd > 0
     ORDER BY COALESCE(d.c,0) DESC`);
  let td = 0, tc = 0;
  for (const r of cmp.rows) {
    td += r.derived; tc += r.counter;
    console.log(`${String(r.shop_id).padEnd(22)} derived $${r.derived.toFixed(4).padStart(8)}  counter $${r.counter.toFixed(4).padStart(8)}  drift $${(r.derived-r.counter).toFixed(4).padStart(8)}`);
  }
  console.log(`${'TOTAL'.padEnd(22)} derived $${td.toFixed(4).padStart(8)}  counter $${tc.toFixed(4).padStart(8)}  drift $${(td-tc).toFixed(4).padStart(8)}`);

  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
