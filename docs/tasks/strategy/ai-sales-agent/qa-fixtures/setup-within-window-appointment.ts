// docs/tasks/strategy/ai-sales-agent/qa-fixtures/setup-within-window-appointment.ts
//
// QA scenario — 24h cancellation guard. Inserts a paid order ~12 hours
// from now so it's INSIDE the 24h cancellation window. The customer's
// upcoming-appointments block tags this with "within 24h" + the
// propose_cancellation tool should refuse to fire (defense-in-depth at
// the orchestrator validator).
//
// If the AI somehow proposes anyway (e.g. stale prompt cache), the
// frontend renders the card in the muted "Cancellation unavailable"
// shape (no tap), and the cancel endpoint itself would 400 if a stale
// client got through to it.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-sales-agent/qa-fixtures/setup-within-window-appointment.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../../../../../backend/.env") });

const SHOP_ID = "peanut";
const CUSTOMER_ADDRESS = "0x6cd05fb7c3d8b1c1abf1b893a0f6deba8a113cf";
const QA_MARKER = `AISA-RC-QA-${Date.now()}`;

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
    console.log(`Connected — setup-within-window-appointment`);
    console.log(`  SHOP_ID=${SHOP_ID}`);
    console.log(`  CUSTOMER_ADDRESS=${CUSTOMER_ADDRESS}`);
    console.log(`  QA_MARKER=${QA_MARKER}\n`);

    const svc = await client.query<{ service_id: string; service_name: string; price_usd: string }>(
      `SELECT service_id, service_name, price_usd
       FROM shop_services
       WHERE shop_id = $1 AND is_active = true
       ORDER BY created_at DESC LIMIT 1`,
      [SHOP_ID]
    );
    if (svc.rowCount === 0) {
      throw new Error(`No active service found for shop_id='${SHOP_ID}'`);
    }
    const service = svc.rows[0];
    console.log(`Step 1 — picked service: ${service.service_name} (${service.service_id})`);

    // Insert a booking ~12h out — well within the 24h cancellation guard.
    const bookingTs = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const bookingDate = bookingTs.toISOString().slice(0, 10);
    const bookingTime = bookingTs.toISOString().slice(11, 16); // HH:MM in UTC; close enough for the guard check (booking_time is stored as a time column; the repo uses ::time casting so we lose tz)

    const orderId = `ord_${randomUUID().slice(0, 12)}`;
    await client.query(
      `INSERT INTO service_orders
         (order_id, service_id, customer_address, shop_id, status,
          total_amount, booking_date, booking_time_slot,
          notes, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, NOW(), NOW())`,
      [
        orderId,
        service.service_id,
        CUSTOMER_ADDRESS.toLowerCase(),
        SHOP_ID,
        parseFloat(service.price_usd) || 0,
        bookingDate,
        bookingTime,
        QA_MARKER,
      ]
    );
    console.log(
      `\nStep 2 — inserted order id=${orderId} for ${service.service_name} on ${bookingDate} at ${bookingTime} (~12h out)`
    );

    console.log("\n✓ Setup complete. To verify:");
    console.log("  1. Open the chat between customer + shop.");
    console.log("  2. Customer message: \"cancel my appointment\".");
    console.log("  3. Expect AI to refuse + offer reschedule-request OR contact-shop alternative IN PLAIN TEXT.");
    console.log(
      "  4. If the AI does propose a cancellation anyway (rare prompt failure), the rendered card should be the muted gray \"Cancellation unavailable\" variant with no tap target."
    );
    console.log("  5. Run `cleanup.ts` when done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("setup-within-window-appointment failed:", err);
  process.exit(1);
});
