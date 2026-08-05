import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r = await c.query(
    `SELECT s.id, s.trigger_reference, s.customer_address, s.status, s.sent_at, s.scheduled_send_at
       FROM auto_message_sends s JOIN shop_auto_messages m ON m.id = s.auto_message_id
      WHERE m.shop_id='peanut' AND m.event_type='booking_created' ORDER BY s.sent_at`);
  console.log(`sends: ${r.rowCount}`);
  r.rows.forEach((x:any)=>console.log(JSON.stringify(x)));
  await c.end();
})();
