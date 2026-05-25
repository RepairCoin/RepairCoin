// docs/tasks/strategy/ai-sales-agent/qa-fixtures/setup-cancellable-appointment.ts
//
// QA scenario — happy-path cancellation. Inserts a paid order 48 hours
// from now for SHOP_ID × CUSTOMER_ADDRESS so the AI's
// upcomingAppointments context sees it and propose_cancellation is
// available. Joins to an existing chat conversation between customer +
// shop (if one exists) so the Phase 5 confirmation message hook fires
// after the tap.
//
// Run:
//   cd backend && npx ts-node ../docs/tasks/strategy/ai-sales-agent/qa-fixtures/setup-cancellable-appointment.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";
import { randomUUID } from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../../../../../backend/.env") });

const SHOP_ID = "peanut";
const CUSTOMER_ADDRESS = "0x6cd05fb7c3d8b1c1abf1b893a0f6deba8a113cf"; // edit if testing as a different customer
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
    console.log(`Connected — setup-cancellable-appointment`);
    console.log(`  SHOP_ID=${SHOP_ID}`);
    console.log(`  CUSTOMER_ADDRESS=${CUSTOMER_ADDRESS}`);
    console.log(`  QA_MARKER=${QA_MARKER}\n`);

    // Step 1 — pick a service that belongs to this shop, ai-enabled.
    const svc = await client.query<{ service_id: string; service_name: string; price_usd: string }>(
      `SELECT service_id, service_name, price_usd
       FROM shop_services
       WHERE shop_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [SHOP_ID]
    );
    if (svc.rowCount === 0) {
      throw new Error(`No active service found for shop_id='${SHOP_ID}'`);
    }
    const service = svc.rows[0];
    console.log(`Step 1 — picked service: ${service.service_name} (${service.service_id})`);

    // Step 2 — look up an existing conversation between customer + shop.
    // Optional — the order works without it; only the Phase 5 confirmation
    // message hook needs it.
    const conv = await client.query<{ conversation_id: string }>(
      `SELECT conversation_id
       FROM conversations
       WHERE shop_id = $1
         AND customer_address = $2
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 1`,
      [SHOP_ID, CUSTOMER_ADDRESS.toLowerCase()]
    );
    const conversationId = conv.rows[0]?.conversation_id ?? null;
    if (conversationId) {
      console.log(`Step 2 — joined to conversation_id=${conversationId}`);
    } else {
      console.log(
        `Step 2 — no existing conversation found; order will NOT trigger the Phase 5 confirmation message hook.`
      );
      console.log(
        `         Send a message to the shop from the customer first to bootstrap a conversation, or test cancellation without that step.`
      );
    }

    // Step 3 — insert the order. 48 hours out → safely outside the 24h
    // cancellation guard. Status='paid' so it surfaces in
    // getUpcomingAppointmentsForShop. notes carries the QA_MARKER for
    // cleanup.
    const orderId = `ord_${randomUUID().slice(0, 12)}`;
    const bookingDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD
    const bookingTime = "14:00"; // arbitrary mid-afternoon slot

    await client.query(
      `INSERT INTO service_orders
         (order_id, service_id, customer_address, shop_id, status,
          total_amount, booking_date, booking_time_slot, conversation_id,
          notes, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        orderId,
        service.service_id,
        CUSTOMER_ADDRESS.toLowerCase(),
        SHOP_ID,
        parseFloat(service.price_usd) || 0,
        bookingDate,
        bookingTime,
        conversationId,
        QA_MARKER,
      ]
    );
    console.log(
      `\nStep 3 — inserted order id=${orderId} for ${service.service_name} on ${bookingDate} at ${bookingTime}`
    );

    console.log("\n✓ Setup complete. To verify:");
    console.log(
      "  1. Open the chat between customer + shop (or start one if no conversation exists)."
    );
    console.log("  2. Customer message: \"cancel my appointment\".");
    console.log(
      "  3. Expect a red Tap-to-cancel card under the AI's bubble for this service + slot."
    );
    console.log(
      "  4. Tap → modal → Confirm. Card flips to emerald 'Cancelled'."
    );
    if (conversationId) {
      console.log(
        "  5. AI follow-up message lands: \"Got it — your appointment at ... has been cancelled.\""
      );
    } else {
      console.log(
        "  5. (No conversation joined → no follow-up confirmation message expected.)"
      );
    }
    console.log(
      "  6. Run `cleanup.ts` to remove the QA order(s) when done."
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("setup-cancellable-appointment failed:", err);
  process.exit(1);
});
