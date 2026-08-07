import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  for (const t of ['homepage_ai_conversations','homepage_ai_messages']) {
    const r = await c.query(`SELECT to_regclass($1) AS tbl`, [`public.${t}`]);
    console.log(`${t}:`, r.rows[0].tbl ?? 'MISSING');
  }
  const m = await c.query(`SELECT version, name FROM schema_migrations WHERE version=270`);
  console.log('migration 270:', m.rows.length ? JSON.stringify(m.rows[0]) : 'not recorded');
  await c.end();
})();
