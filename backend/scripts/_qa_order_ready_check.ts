import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const col = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='service_orders' AND column_name='ready_notified_at'`);
  console.log('ready_notified_at column:', col.rows.length ? 'present' : 'MISSING');
  const m = await c.query(`SELECT version, name FROM schema_migrations WHERE version=269`);
  console.log('migration 269:', m.rows.length ? JSON.stringify(m.rows[0]) : 'not recorded');
  await c.end();
})();
