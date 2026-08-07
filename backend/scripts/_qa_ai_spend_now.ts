import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const t = await c.query(`SELECT to_regclass('public.ai_usage_events') AS t`);
  if (!t.rows[0].t) { console.log('ai_usage_events: MISSING'); await c.end(); return; }
  const m = await c.query(`SELECT COALESCE(SUM(cost_usd),0)::numeric(10,4) spend, COUNT(*)::int calls
      FROM ai_usage_events WHERE created_at >= date_trunc('month', NOW())`);
  console.log('this month  spend=$' + m.rows[0].spend, 'calls=' + m.rows[0].calls);
  const l30 = await c.query(`SELECT COALESCE(SUM(cost_usd),0)::numeric(10,4) spend FROM ai_usage_events WHERE created_at >= NOW() - INTERVAL '30 days'`);
  console.log('last 30d    spend=$' + l30.rows[0].spend);
  await c.end();
})();
