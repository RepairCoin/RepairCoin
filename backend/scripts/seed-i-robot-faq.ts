/**
 * Seed FAQ entries for the I Robot service on staging.
 *
 * Lets us smoke-test the Phase 1 prompt path end-to-end: with these
 * entries in place, asking the AI "what's in the kit?" or "is it safe
 * around toddlers?" should produce direct factual answers quoting from
 * the FAQ instead of the teammate-handoff baseline.
 *
 * Idempotent: replaces all existing entries for the service. Safe to
 * re-run after iterating on the entry text.
 *
 * Run: npx ts-node scripts/seed-i-robot-faq.ts
 */

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const I_ROBOT_SERVICE_ID = "srv_4287324a-51e6-49ce-b556-ceb8907a1499";

const ENTRIES: { question: string; answer: string }[] = [
  {
    question: "What's included in this service?",
    answer:
      "The full modular hardware kit (chassis, IR + ultrasonic sensors, brushed-motor controller, 4-mic array, 5W speaker, ESP32-based main board, 3000 mAh battery), hands-on assembly with a certified technician, firmware flashing, Wi-Fi pairing, one starter routine of your choice, and a 14-day software-tweak follow-up.",
  },
  {
    question: "What's NOT included?",
    answer:
      "Ongoing maintenance after the 14-day follow-up window (billed at $89/visit), third-party accessories outside our kit catalog, structural modifications beyond the supplied chassis, and replacement parts for damage from misuse.",
  },
  {
    question: "How long does a typical appointment take?",
    answer:
      "Sessions typically run about 90 minutes from start to finish. You leave with a working bot the same day.",
  },
  {
    question: "Is it safe around children and pets?",
    answer:
      "Yes — plastic and light metal parts only, low-voltage throughout (5V main board, 12V motor controller; no line voltage). The motor controller has overcurrent protection and the sensors include a stop-on-touch reflex. Sound output is capped at 70 dB and can be muted entirely. Indoor use only; not waterproof.",
  },
  {
    question: "What should I bring?",
    answer:
      "Just yourself. Bring a laptop only if you'd like to learn the configuration tools alongside the technician — otherwise we handle the full setup. No prior robotics experience needed.",
  },
  {
    question: "What smart-home hubs do you integrate with?",
    answer:
      "Home Assistant, Google Home, and Apple HomeKit are supported out of the box. Voice command languages: English, Filipino, and Spanish. Note: the Wi-Fi network needs to be 2.4 GHz (the ESP32 module doesn't speak 5 GHz) — most home routers serve both.",
  },
  {
    question: "What's your cancellation or warranty policy?",
    answer:
      "Cancellations before the session start are refundable minus a 10% restocking fee. Once assembled, the kit isn't returnable. Hardware warranty: 90 days on supplied components, manufacturing defects only. Software tweaks free within the first 14 days; after that, repairs are quoted before any work.",
  },
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const exists = await client.query(
      `SELECT service_id, service_name FROM shop_services WHERE service_id = $1`,
      [I_ROBOT_SERVICE_ID]
    );
    if (exists.rows.length === 0) {
      console.error(`Service ${I_ROBOT_SERVICE_ID} not found — aborting.`);
      process.exit(1);
    }
    console.log("Target service:", exists.rows[0].service_name);

    await client.query("BEGIN");
    const deleted = await client.query(
      `DELETE FROM service_ai_faq_entries WHERE service_id = $1`,
      [I_ROBOT_SERVICE_ID]
    );
    console.log(`Deleted ${deleted.rowCount} existing entries.`);

    for (let i = 0; i < ENTRIES.length; i++) {
      const e = ENTRIES[i];
      await client.query(
        `INSERT INTO service_ai_faq_entries (service_id, question, answer, display_order)
         VALUES ($1, $2, $3, $4)`,
        [I_ROBOT_SERVICE_ID, e.question, e.answer, i]
      );
    }
    await client.query("COMMIT");

    const final = await client.query(
      `SELECT display_order, question, LENGTH(answer) as answer_len
         FROM service_ai_faq_entries
        WHERE service_id = $1
        ORDER BY display_order ASC`,
      [I_ROBOT_SERVICE_ID]
    );
    console.log(`\n✅ Inserted ${final.rows.length} entries:`);
    for (const r of final.rows) {
      console.log(`  ${r.display_order}. ${r.question}  (${r.answer_len} chars)`);
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
