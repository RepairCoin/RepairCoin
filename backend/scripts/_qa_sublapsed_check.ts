import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const all = await c.query(`SELECT shop_id, stripe_subscription_id, status FROM stripe_subscriptions ORDER BY shop_id LIMIT 10`);
  console.log(`stripe_subscriptions rows: ${all.rowCount}`);
  all.rows.forEach((r:any)=>console.log('  '+JSON.stringify(r)));
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='stripe_subscriptions'`);
  console.log('columns:', cols.rows.map((x:any)=>x.column_name).join(', '));
  await c.end();
})();
