import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const q = async (label:string, sql:string) => {
    const r = await c.query(sql);
    console.log(`\n${label}`);
    r.rows.forEach((x:any)=>console.log('  '+Object.values(x).join('  |  ')));
    if(!r.rows.length) console.log('  (none)');
  };
  await q('service categories in use', `SELECT category, COUNT(*)::int n FROM shop_services WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);
  await q('does any status column already mention ready?', `SELECT table_name, column_name FROM information_schema.columns WHERE column_name ILIKE '%ready%' OR column_name ILIKE '%pickup%' LIMIT 10`);
  await q('shops by name (sample)', `SELECT shop_id, name FROM shops WHERE active = true ORDER BY created_at DESC LIMIT 12`);
  await c.end();
})();
