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
    // Check if migrations table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('schema_migrations', 'migrations')
    `);
    console.log("Migration tracking tables present:", tableCheck.rows.map((r) => r.table_name).join(", ") || "<none>");

    // List most-recent applied migrations
    if (tableCheck.rows.some((r) => r.table_name === "schema_migrations")) {
      const recent = await client.query(`
        SELECT version, name, applied_at
        FROM schema_migrations
        ORDER BY version DESC
        LIMIT 12
      `);
      console.log("\nMost recent applied migrations:");
      for (const r of recent.rows) {
        console.log(`  ${r.version}  ${r.name}  (applied ${r.applied_at?.toISOString?.() ?? r.applied_at})`);
      }
      // Look specifically for 113
      const has113 = await client.query(`SELECT 1 FROM schema_migrations WHERE version = 113`);
      console.log("\n113 applied?", has113.rows.length > 0 ? "YES" : "NO");
    }
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
