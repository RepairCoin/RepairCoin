/**
 * Script to create test database for RepairCoin
 * Run: node create-test-db.js
 */

const { Client } = require("pg");

async function createTestDatabase() {
  console.log("🔧 Setting up test database...\n");

  // CHANGE THESE TO MATCH YOUR POSTGRESQL CREDENTIALS
  const config = {
    host: "localhost",
    port: 5432,
    user: "doadmin", // ← Change if different
    password: "AVNS_lW7Pis3I_phB6sDplys", // ← IMPORTANT: Change this!
    database: "postgres", // Connect to default DB first
  };

  // Create client
  const client = new Client(config);

  try {
    // Connect
    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Check if database exists
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'repaircoin_test'"
    );

    if (checkResult.rows.length > 0) {
      console.log("ℹ️  Database repaircoin_test already exists");
    } else {
      // Create database
      await client.query("CREATE DATABASE repaircoin_test");
      console.log("✅ Database repaircoin_test created successfully!");
    }

    console.log("\n📋 Next steps:");
    console.log("1. Update backend/.env.test with your DB credentials");
    console.log("2. Fix PRIVATE_KEY in .env.test (change from all zeros)");
    console.log("3. Run: set NODE_ENV=test && npm run migrate");
    console.log(
      "4. Run: npm test tests/customer/customer.comprehensive.test.ts"
    );
  } catch (error) {
    console.error("❌ Error:", error.message);

    if (error.message.includes("password authentication failed")) {
      console.error("\n💡 Fix: Update the password in this script (line 13)");
    } else if (error.message.includes("ECONNREFUSED")) {
      console.error("\n💡 Fix: Make sure PostgreSQL is running");
      console.error("   Check: services.msc → PostgreSQL service");
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run it
createTestDatabase();
