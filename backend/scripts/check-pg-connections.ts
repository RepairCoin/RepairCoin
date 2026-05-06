// Diagnose PostgreSQL connection-pool exhaustion on staging.
// Uses ONE direct pg.Client (not a Pool) to avoid worsening the issue.
// Run from backend/: npx ts-node scripts/check-pg-connections.ts

import { Client } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "25060", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  await client.connect();

  try {
    const summary = await client.query<any>(`
      SELECT
        current_setting('max_connections')                                      AS max_connections,
        current_setting('superuser_reserved_connections')                       AS superuser_reserved,
        SUM(CASE WHEN state = 'active' THEN 1 ELSE 0 END)::int                 AS total_active,
        SUM(CASE WHEN state = 'idle' THEN 1 ELSE 0 END)::int                   AS total_idle,
        SUM(CASE WHEN state = 'idle in transaction' THEN 1 ELSE 0 END)::int    AS total_idle_in_tx,
        COUNT(*)::int                                                          AS total
      FROM pg_stat_activity
      WHERE datname IS NOT NULL;
    `);
    console.log("=== Connection summary ===");
    console.table(summary.rows);

    const perDb = await client.query(`
      SELECT datname, COUNT(*)::int AS conns
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
      GROUP BY datname
      ORDER BY conns DESC;
    `);
    console.log("\n=== Per-database breakdown ===");
    console.table(perDb.rows);

    const perApp = await client.query(`
      SELECT
        COALESCE(application_name, '<none>') AS application_name,
        COALESCE(client_addr::text, '<local>') AS client_addr,
        usename,
        state,
        COUNT(*)::int AS conns
      FROM pg_stat_activity
      WHERE datname = $1
      GROUP BY application_name, client_addr, usename, state
      ORDER BY conns DESC;
    `, [process.env.DB_NAME]);
    console.log(`\n=== Per-application breakdown for db='${process.env.DB_NAME}' ===`);
    console.table(perApp.rows);

    const orphans = await client.query(`
      SELECT
        pid,
        COALESCE(application_name, '<none>') AS application_name,
        COALESCE(client_addr::text, '<local>') AS client_addr,
        usename,
        state,
        EXTRACT(EPOCH FROM (now() - state_change))::int AS idle_seconds,
        LEFT(query, 80) AS last_query
      FROM pg_stat_activity
      WHERE datname IS NOT NULL
        AND state IN ('idle', 'idle in transaction')
        AND state_change < now() - interval '5 minutes'
      ORDER BY state_change ASC
      LIMIT 30;
    `);
    console.log(`\n=== Idle > 5 min (orphan candidates) — found ${orphans.rowCount} ===`);
    if (orphans.rowCount && orphans.rowCount > 0) {
      console.table(orphans.rows);
    }

    const all = await client.query(`
      SELECT
        pid,
        COALESCE(application_name, '<none>') AS application_name,
        COALESCE(client_addr::text, '<local>') AS client_addr,
        usename,
        state,
        EXTRACT(EPOCH FROM (now() - state_change))::int AS idle_s,
        LEFT(query, 60) AS last_query
      FROM pg_stat_activity
      WHERE datname = $1
      ORDER BY state_change ASC;
    `, [process.env.DB_NAME]);
    console.log(`\n=== All connections on db='${process.env.DB_NAME}' (${all.rowCount} total) ===`);
    console.table(all.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Query failed:", err.message);
  process.exit(1);
});
