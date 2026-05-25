// docs/tasks/strategy/ai-sales-agent/qa-fixtures/cleanup.ts
//
// Hard-deletes the QA-fixture rows inserted by the setup-* scripts.
// Targets only rows tagged with the `AISA-RC-QA-` marker prefix:
//   - service_orders.notes LIKE 'AISA-RC-QA-%'
//   - appointment_reschedule_requests.customer_reason LIKE 'AISA-RC-QA-%'
//
// Real customer cancellations + reschedule requests don't carry this
// marker (the AI cancel modal trims/caps free-form text but doesn't
// inject prefixes), so cleanup is collision-free.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-sales-agent/qa-fixtures/cleanup.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../../backend/.env") });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();
  try {
    console.log("Connected — cleaning up AI Sales Agent QA fixtures.\n");

    // 1. Delete reschedule requests first (they FK to orders — though FK is
    //    ON DELETE CASCADE, deleting requests explicitly gives a more
    //    informative deletion count).
    const requests = await client.query(
      `DELETE FROM appointment_reschedule_requests
       WHERE customer_reason LIKE 'AISA-RC-QA-%'`
    );
    console.log(`Deleted ${requests.rowCount} QA reschedule request(s).`);

    // 2. Delete orders.
    const orders = await client.query(
      `DELETE FROM service_orders
       WHERE notes LIKE 'AISA-RC-QA-%'`
    );
    console.log(`Deleted ${orders.rowCount} QA order(s).`);

    // 3. Also delete any AI confirmation messages our handlers posted for
    //    these orders. Without this, the chat thread would still show
    //    "Got it — your appointment ... has been cancelled" from a prior
    //    test, which is confusing on re-runs.
    const messages = await client.query(
      `DELETE FROM messages
       WHERE metadata->>'generated_by' = 'ai_agent'
         AND metadata->>'source' IN ('cancellation_confirmed', 'reschedule_request_submitted')
         AND metadata->>'order_id' NOT IN (
           SELECT order_id FROM service_orders
         )`
    );
    console.log(
      `Deleted ${messages.rowCount} dangling confirmation message(s) (orders gone).`
    );

    console.log("\n✓ Cleanup complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("cleanup failed:", err);
  process.exit(1);
});
