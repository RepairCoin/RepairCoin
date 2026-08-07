import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const s = await c.query(`DELETE FROM auto_message_sends WHERE auto_message_id IN (SELECT id FROM shop_auto_messages WHERE shop_id='peanut' AND event_type='booking_created') RETURNING id`);
  const o = await c.query(`DELETE FROM service_orders WHERE order_id LIKE 'qa-bc-%' RETURNING order_id`);
  console.log(`removed ${s.rowCount} QA sends, ${o.rowCount} QA orders: ${o.rows.map((r:any)=>r.order_id).join(', ')}`);
  await c.end();
})();
