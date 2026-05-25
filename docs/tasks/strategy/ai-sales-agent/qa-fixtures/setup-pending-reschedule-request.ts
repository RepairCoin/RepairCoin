// docs/tasks/strategy/ai-sales-agent/qa-fixtures/setup-pending-reschedule-request.ts
//
// QA scenario — Q2 pending-request collision. Inserts a paid order 48h+
// out AND a pending row in appointment_reschedule_requests for that
// order. The upcoming-appointments block tags this order with "pending
// reschedule request"; the propose_reschedule_request tool's order_id
// enum should exclude it; if forced through, server-side validation
// emits a `reschedule_tool_pending_request_exists` drop reason.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-sales-agent/qa-fixtures/setup-pending-reschedule-request.ts

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
    console.log(`Connected — setup-pending-reschedule-request`);
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

    // Insert paid order 48h out.
    const bookingDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const bookingTime = "14:00";
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
      `Step 2 — inserted order id=${orderId} for ${service.service_name} on ${bookingDate} at ${bookingTime}`
    );

    // Insert a corresponding pending reschedule request. customer_reason
    // carries the QA_MARKER for cleanup.
    const requestId = randomUUID();
    const newDate = new Date(Date.now() + 96 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await client.query(
      `INSERT INTO appointment_reschedule_requests
         (request_id, order_id, shop_id, customer_address,
          original_date, original_time_slot,
          requested_date, requested_time_slot,
          customer_reason, status, expires_at, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending',
          NOW() + INTERVAL '48 hours', NOW(), NOW())`,
      [
        requestId,
        orderId,
        SHOP_ID,
        CUSTOMER_ADDRESS.toLowerCase(),
        bookingDate,
        bookingTime,
        newDate,
        "15:00",
        QA_MARKER, // customer_reason — also used for cleanup matching
      ]
    );
    console.log(`Step 3 — inserted pending reschedule request id=${requestId}`);

    console.log("\n✓ Setup complete. To verify:");
    console.log("  1. Open the chat between customer + shop.");
    console.log(
      "  2. Customer message: \"can I move my appointment to next week?\""
    );
    console.log(
      "  3. Expect AI to refuse + route to dashboard IN PLAIN TEXT (e.g. \"You already have a pending reschedule request — manage it from your dashboard\")."
    );
    console.log(
      "  4. The AI should NOT render a RescheduleRequestCard (tool's order_id enum excludes pending-request orders)."
    );
    console.log("  5. Run `cleanup.ts` when done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("setup-pending-reschedule-request failed:", err);
  process.exit(1);
});
