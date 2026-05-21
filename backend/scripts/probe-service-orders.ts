import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const c = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const cols = await c.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name='service_orders' ORDER BY ordinal_position`
  );
  console.log("=== service_orders columns ===");
  for (const r of cols.rows) {
    console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`);
  }

  console.log("\n=== distinct status values ===");
  const s = await c.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM service_orders GROUP BY status ORDER BY COUNT(*) DESC`
  );
  for (const r of s.rows) console.log(`  ${r.status.padEnd(15)} ${r.n}`);

  console.log("\n=== latest 5 rows ===");
  const sample = await c.query(
    `SELECT shop_id, status, total_amount, created_at, completed_at
     FROM service_orders ORDER BY created_at DESC LIMIT 5`
  );
  for (const r of sample.rows) {
    console.log(
      `  shop=${r.shop_id} status=${r.status} total=${r.total_amount} created=${r.created_at}`
    );
  }

  console.log("\n=== peanut shop earliest+latest ===");
  const range = await c.query(
    `SELECT MIN(created_at) AS first, MAX(created_at) AS last, COUNT(*) AS n
     FROM service_orders WHERE shop_id = 'peanut'`
  );
  console.log(range.rows[0]);

  console.log("\n=== peanut shop revenue by status ===");
  const byStatus = await c.query(
    `SELECT status, COUNT(*) AS n, COALESCE(SUM(total_amount), 0) AS total
     FROM service_orders WHERE shop_id = 'peanut'
     GROUP BY status ORDER BY COALESCE(SUM(total_amount), 0) DESC`
  );
  for (const r of byStatus.rows) {
    console.log(`  status=${r.status} count=${r.n} total=$${r.total}`);
  }

  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
