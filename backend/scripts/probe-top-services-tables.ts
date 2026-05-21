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

  // 1. Service table — name + key columns
  console.log("=== shop_services columns (head) ===");
  const cols = await c.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name='shop_services' ORDER BY ordinal_position LIMIT 30`
  );
  for (const r of cols.rows) console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`);

  // 2. Confirm service_id key in service_orders ↔ shop_services
  console.log("\n=== sample shop_services for peanut ===");
  const svc = await c.query(
    `SELECT service_id, service_name, price_usd, active
     FROM shop_services WHERE shop_id='peanut' LIMIT 6`
  );
  for (const r of svc.rows) {
    console.log(`  id=${r.service_id} name='${r.service_name}' price=$${r.price_usd} active=${r.is_active}`);
  }

  // 3. service_orders.service_id check
  console.log("\n=== service_orders.service_id distinct for peanut ===");
  const ids = await c.query(
    `SELECT service_id, COUNT(*) AS n FROM service_orders
     WHERE shop_id='peanut' GROUP BY service_id ORDER BY COUNT(*) DESC LIMIT 8`
  );
  for (const r of ids.rows) console.log(`  service_id=${r.service_id} n=${r.n}`);

  // 4. List tables that may hold "AI conversations" or "views"
  console.log("\n=== tables matching conversation/message/view ===");
  const t = await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND (
       table_name ILIKE '%conversation%' OR
       table_name ILIKE '%message%' OR
       table_name ILIKE '%view%' OR
       table_name ILIKE '%session%')
     ORDER BY table_name`
  );
  for (const r of t.rows) console.log(`  ${r.table_name}`);

  // 5. Inspect conversations table for service_id linkage
  console.log("\n=== conversations columns ===");
  const ccol = await c.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name='conversations' ORDER BY ordinal_position`
  );
  for (const r of ccol.rows) console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`);

  console.log("\n=== conversations sample for peanut ===");
  try {
    const cs = await c.query(
      `SELECT * FROM conversations WHERE shop_id='peanut' ORDER BY created_at DESC LIMIT 3`
    );
    if (cs.rows.length === 0) console.log("  (none)");
    else for (const r of cs.rows) console.log(`  ${JSON.stringify(r).substring(0, 200)}...`);
  } catch (e: any) {
    console.log(`  err: ${e.message}`);
  }

  console.log("\n=== conversations counts by service_id for peanut ===");
  try {
    const cc = await c.query(
      `SELECT service_id, COUNT(*) AS n FROM conversations
       WHERE shop_id='peanut' GROUP BY service_id ORDER BY COUNT(*) DESC LIMIT 6`
    );
    for (const r of cc.rows) console.log(`  service_id=${r.service_id} n=${r.n}`);
  } catch (e: any) {
    console.log(`  err: ${e.message}`);
  }

  // 6. Reference revenue-by-service
  console.log("\n=== peanut: revenue per service (paid+completed, all-time) ===");
  const rev = await c.query(
    `SELECT o.service_id, s.service_name,
            COUNT(*) AS n, SUM(o.total_amount) AS revenue
     FROM service_orders o
     LEFT JOIN shop_services s ON s.service_id = o.service_id
     WHERE o.shop_id='peanut' AND o.status IN ('paid','completed')
     GROUP BY o.service_id, s.service_name
     ORDER BY SUM(o.total_amount) DESC LIMIT 6`
  );
  for (const r of rev.rows) {
    console.log(`  '${r.service_name}' orders=${r.n} revenue=$${r.revenue}`);
  }

  console.log("\n=== peanut: bookings per service (ALL statuses, all-time) ===");
  const bk = await c.query(
    `SELECT o.service_id, s.service_name, COUNT(*) AS n
     FROM service_orders o
     LEFT JOIN shop_services s ON s.service_id = o.service_id
     WHERE o.shop_id='peanut'
     GROUP BY o.service_id, s.service_name
     ORDER BY COUNT(*) DESC LIMIT 6`
  );
  for (const r of bk.rows) {
    console.log(`  '${r.service_name}' n=${r.n}`);
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
