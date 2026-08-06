import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const t = await c.query(`SELECT to_regclass('public.shop_tasks') AS tbl`);
  console.log('shop_tasks table:', t.rows[0].tbl ?? 'MISSING');
  const m = await c.query(`SELECT version, name FROM schema_migrations WHERE version = 268`);
  console.log('migration 268:', m.rows.length ? JSON.stringify(m.rows[0]) : 'not recorded');
  if (t.rows[0].tbl) {
    const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='shop_tasks' ORDER BY ordinal_position`);
    console.log('columns:', cols.rows.map((x:any)=>x.column_name).join(', '));
  }
  await c.end();
})();
