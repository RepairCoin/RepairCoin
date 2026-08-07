import * as dotenv from 'dotenv'; import * as path from 'path'; import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r = await c.query(`SELECT COUNT(*)::int n, AVG(cost_usd)::numeric(10,6) avg, SUM(cost_usd)::numeric(10,6) total, AVG(latency_ms)::int lat
    FROM homepage_ai_messages WHERE answered_by='model' AND cost_usd IS NOT NULL`);
  const x = r.rows[0];
  console.log(`model answers: ${x.n}  avg=$${x.avg}  total=$${x.total}  avg latency=${x.lat}ms`);
  if (x.avg > 0) {
    console.log(`$2/day  ≈ ${Math.floor(2 / Number(x.avg))} answers/day`);
    console.log(`$25/mo  ≈ ${Math.floor(25 / Number(x.avg))} answers/month`);
  }
  await c.end();
})();
