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

  for (const t of ["transactions", "customers"]) {
    console.log(`\n=== ${t} columns ===`);
    const cols = await c.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name=$1 ORDER BY ordinal_position`,
      [t]
    );
    for (const r of cols.rows) {
      console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`);
    }
  }

  console.log("\n=== transactions distinct types ===");
  const types = await c.query(
    `SELECT type, COUNT(*) AS n FROM transactions GROUP BY type ORDER BY COUNT(*) DESC`
  );
  for (const r of types.rows) console.log(`  ${r.type.padEnd(20)} ${r.n}`);

  console.log("\n=== sample transactions where shop_id='peanut' ===");
  const sample = await c.query(
    `SELECT type, customer_address, shop_id, amount, created_at
     FROM transactions WHERE shop_id = 'peanut' ORDER BY created_at DESC LIMIT 5`
  );
  for (const r of sample.rows) {
    console.log(
      `  type=${r.type} customer=${r.customer_address?.substring(0, 12)} amount=${r.amount} created=${r.created_at}`
    );
  }

  console.log("\n=== peanut customer name lookup sanity ===");
  const cs = await c.query(
    `SELECT address, name, email FROM customers
     WHERE address IN (SELECT DISTINCT customer_address FROM service_orders WHERE shop_id='peanut' LIMIT 5)
     LIMIT 5`
  );
  for (const r of cs.rows) {
    console.log(`  address=${r.address.substring(0, 18)}... name=${r.name} email=${r.email}`);
  }

  console.log("\n=== peanut top spenders (paid+completed) — manual reference ===");
  const spenders = await c.query(
    `SELECT customer_address, COUNT(*) AS n, SUM(total_amount) AS total
     FROM service_orders
     WHERE shop_id='peanut' AND status IN ('paid','completed')
     GROUP BY customer_address
     ORDER BY SUM(total_amount) DESC
     LIMIT 5`
  );
  for (const r of spenders.rows) {
    console.log(
      `  customer=${r.customer_address?.substring(0, 18)}... orders=${r.n} spend=$${r.total}`
    );
  }

  console.log("\n=== peanut top RCN earners — manual reference ===");
  const earners = await c.query(
    `SELECT customer_address, SUM(amount) AS rcn
     FROM transactions
     WHERE shop_id='peanut' AND type='mint'
     GROUP BY customer_address
     ORDER BY SUM(amount) DESC
     LIMIT 5`
  );
  for (const r of earners.rows) {
    console.log(`  customer=${r.customer_address?.substring(0, 18)}... rcn=${r.rcn}`);
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
