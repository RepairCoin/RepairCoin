// Isolates WHY booking_created did not fire on a real deployed booking.
//
// Two candidates, and they need different fixes:
//   A. the rule is not eligible  → nothing would fire it, publish or not
//   B. the rule is fine          → the event never reached the bus on the deployed server
//
// Calling handleEventTrigger locally with the same order id separates them: if it sends, the rule was
// always fine and the publish is the problem.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { autoMessageSchedulerService } from '../src/services/AutoMessageSchedulerService';

const SHOP = 'peanut';

async function main() {
  const orderId = process.argv[2];
  if (!orderId) { console.error('usage: _qa_bc_diagnose.ts <orderId>'); process.exit(1); }

  const db = new Client({
    host: process.env.DB_HOST, port: +(process.env.DB_PORT || 25060),
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const { rows: rules } = await db.query(
    `SELECT id, name, event_type, trigger_type, is_active, status, surface, action_type,
            delay_hours, target_audience, max_sends_per_customer
       FROM shop_auto_messages WHERE shop_id=$1 AND event_type='booking_created'`,
    [SHOP]
  );
  console.log(`\nbooking_created rules on ${SHOP}: ${rules.length}`);
  rules.forEach((r: any) => console.log(`  ${JSON.stringify(r, null, 2)}`));

  const { rows: order } = await db.query(
    `SELECT order_id, customer_address, status, created_at FROM service_orders WHERE order_id=$1`,
    [orderId]
  );
  console.log(`\norder ${orderId}: ${order.length ? JSON.stringify(order[0]) : 'NOT FOUND'}`);
  if (!order.length) { await db.end(); return; }

  const sendsFor = async () =>
    (await db.query(
      `SELECT s.* FROM auto_message_sends s JOIN shop_auto_messages m ON m.id = s.auto_message_id
        WHERE m.shop_id=$1 AND m.event_type='booking_created'`, [SHOP]
    )).rows;

  console.log(`\nsends before local fire: ${(await sendsFor()).length}`);

  console.log('\n=== firing handleEventTrigger locally with the same order ===');
  const res = await autoMessageSchedulerService.handleEventTrigger('booking_created', {
    shopId: SHOP,
    customerAddress: order[0].customer_address,
    orderId,
  });
  console.log(`  scheduledCount: ${res.scheduledCount}`);
  const after = await sendsFor();
  console.log(`  sends after: ${after.length}`);

  console.log();
  if (after.length) {
    console.log('VERDICT B — the rule was always eligible. The event did not reach the bus on the');
    console.log('           deployed server, so the PaymentService publish is not live or it threw.');
  } else {
    console.log('VERDICT A — even a direct fire sends nothing. The rule itself is not eligible;');
    console.log('           the publish is not implicated. Check is_active/status/entitlement above.');
  }
  await db.end();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
