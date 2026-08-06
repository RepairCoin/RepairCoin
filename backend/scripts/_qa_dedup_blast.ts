import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const c = new Client({host:process.env.DB_HOST,port:+(process.env.DB_PORT||25060),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});
  await c.connect();
  const q = async (label: string, sql: string) => {
    const r = await c.query(sql);
    console.log(`\n${label}`);
    r.rows.forEach((x:any)=>console.log('  ' + JSON.stringify(x)));
    if (!r.rows.length) console.log('  (none)');
  };
  await q('event rules, by event type + delay',
    `SELECT event_type, delay_hours, COUNT(*)::int rules, SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int active
       FROM shop_auto_messages WHERE trigger_type='event' GROUP BY 1,2 ORDER BY 3 DESC`);
  await q('sends from IMMEDIATE event rules (dead-guard path)',
    `SELECT COUNT(*)::int sends, COUNT(DISTINCT s.customer_address)::int customers
       FROM auto_message_sends s JOIN shop_auto_messages m ON m.id=s.auto_message_id
      WHERE m.trigger_type='event' AND m.delay_hours=0`);
  await q('actual duplicates: same rule + customer more than once',
    `SELECT m.event_type, s.customer_address, COUNT(*)::int n
       FROM auto_message_sends s JOIN shop_auto_messages m ON m.id=s.auto_message_id
      WHERE m.trigger_type='event' AND m.delay_hours=0
      GROUP BY 1,2 HAVING COUNT(*)>1 ORDER BY 3 DESC LIMIT 10`);
  await c.end();
})();
