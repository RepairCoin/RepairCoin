import * as dotenv from 'dotenv'; import * as path from 'path'; import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r = await c.query(`SELECT question, answered_by, cost_usd, latency_ms, LEFT(COALESCE(answer,''), 90) ans
    FROM homepage_ai_messages WHERE created_at > NOW() - INTERVAL '20 minutes' ORDER BY created_at`);
  r.rows.forEach((x:any)=>console.log(`[${x.answered_by.padEnd(8)}] ${String(x.latency_ms).padStart(5)}ms $${x.cost_usd ?? '-'}  "${x.question}"\n            ${x.ans}`));
  await c.end();
})();
