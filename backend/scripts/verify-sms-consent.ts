// Confirms the compliant SMS opt-in actually RECORDS consent (Twilio toll-free, reason 30498).
// Run it AFTER toggling "SMS Notifications" on/off for a test customer in the app.
//
//   cd backend && npx ts-node scripts/verify-sms-consent.ts               # recent explicit opt-ins
//   cd backend && npx ts-node scripts/verify-sms-consent.ts +15551234567  # one phone
//
// READ-ONLY. An explicit opt-in from the settings toggle lands with source='notification_preferences'
// (implied inbound consent is source='inbound_message' — different, and not what we're verifying).

import * as path from 'path'; import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.DB_HOST, port: +(process.env.DB_PORT||'5432'), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

const phoneArg = process.argv[2];

(async () => {
  if (phoneArg) {
    const r = await pool.query(
      `SELECT phone, channel, status, source, TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI') AS updated
         FROM customer_messaging_consent WHERE phone = $1 ORDER BY channel`, [phoneArg]);
    console.log(`=== consent rows for ${phoneArg} ===`);
    if (!r.rows.length) console.log('  none — the toggle did not record consent for this phone (check the phone is on the profile)');
    for (const x of r.rows) console.log(`  ${x.channel}  ${x.status.toUpperCase().padEnd(8)} source=${x.source}  updated ${x.updated}`);
    const smsGranted = r.rows.some((x:any)=>x.channel==='sms' && x.status==='granted');
    console.log(`\nVERDICT: SMS consent for ${phoneArg} is ${smsGranted ? '✅ GRANTED (opt-in recorded)' : '⛔ NOT granted (revoked or absent)'}`);
    await pool.end(); return;
  }

  console.log('=== most recent EXPLICIT opt-ins from the settings toggle (source=notification_preferences) ===');
  const recent = await pool.query(
    `SELECT phone, channel, status, TO_CHAR(updated_at,'YYYY-MM-DD HH24:MI') AS updated
       FROM customer_messaging_consent
      WHERE source = 'notification_preferences'
      ORDER BY updated_at DESC LIMIT 15`);
  if (!recent.rows.length) console.log('  none yet — toggle SMS on for a test customer, Save, then re-run.');
  for (const x of recent.rows) console.log(`  ${String(x.phone).padEnd(16)} ${x.channel}  ${x.status.toUpperCase().padEnd(8)}  updated ${x.updated}`);

  console.log('\n=== consent totals by source + status (context) ===');
  const sum = await pool.query(
    `SELECT source, status, COUNT(*)::int c FROM customer_messaging_consent GROUP BY source, status ORDER BY source, status`);
  for (const x of sum.rows) console.log(`  ${String(x.source ?? '(none)').padEnd(24)} ${x.status.padEnd(8)} ${x.c}`);
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
