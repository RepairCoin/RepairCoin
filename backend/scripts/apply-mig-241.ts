import * as path from 'path'; import * as fs from 'fs'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT||'5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '241_ai_usage_events_management_labels.sql'), 'utf8');
  await pool.query(sql);
  await pool.query(`INSERT INTO schema_migrations (version, name) VALUES (241, '241_ai_usage_events_management_labels') ON CONFLICT (version) DO NOTHING`);

  console.log('=== feature labels now emitted by the view (30d) ===');
  const r = await pool.query(
    `SELECT feature, COUNT(*)::int calls, COALESCE(SUM(cost_usd),0)::float cost
       FROM ai_usage_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY feature ORDER BY 3 DESC`);
  for (const x of r.rows) console.log(`  ${x.feature.padEnd(18)} ${String(x.calls).padStart(4)} calls  $${x.cost.toFixed(4)}`);

  const gone = r.rows.filter((x: any) => x.feature === 'orchestrate' || x.feature === 'insights');
  const asst = r.rows.find((x: any) => x.feature === 'assistant');
  const rec = r.rows.find((x: any) => x.feature === 'ai_recommendation');
  console.log('\nold slugs gone:', gone.length === 0 ? 'YES' : 'NO — ' + gone.map((x:any)=>x.feature).join(','));
  console.log('assistant present:', asst ? `YES ($${asst.cost.toFixed(4)})` : 'NO');
  console.log('ai_recommendation present:', rec ? `YES ($${rec.cost.toFixed(4)})` : 'NO');
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
