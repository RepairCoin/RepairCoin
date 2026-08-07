import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const tot = await c.query(`SELECT answered_by, COUNT(*)::int n FROM homepage_ai_messages GROUP BY 1 ORDER BY 2 DESC`);
  console.log('=== answered_by ===');
  tot.rows.forEach((r:any)=>console.log(`  ${String(r.n).padStart(3)}  ${r.answered_by}`));
  const all = await c.query(`SELECT question, answered_by, matched_article, match_score, created_at FROM homepage_ai_messages ORDER BY created_at DESC LIMIT 40`);
  console.log(`\n=== last ${all.rowCount} questions ===`);
  all.rows.forEach((r:any)=>console.log(`  [${r.answered_by.padEnd(8)}] ${String(r.match_score ?? '-').padStart(3)} ${(r.matched_article ?? '').padEnd(32)} "${r.question}"`));
  await c.end();
})();
