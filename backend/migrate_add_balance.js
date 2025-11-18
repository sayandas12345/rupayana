// migrate_add_balance.js
// Safe migration: add balance column to users if missing

require('dotenv').config();
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("No DATABASE_URL in env. Exiting.");
  process.exit(1);
}

(async () => {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to DB");

    // Check if 'balance' column already exists
    const checkRes = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'balance'
    `);

    if (checkRes.rows.length > 0) {
      console.log("ℹ️ Column 'balance' already exists. Nothing to do.");
    } else {
      console.log("🛠 Column 'balance' missing — adding it now...");
      await client.query(`ALTER TABLE users ADD COLUMN balance integer DEFAULT 0`);
      console.log("✅ Added column 'balance' (integer DEFAULT 0).");

      // Ensure all rows have some value
      await client.query(`UPDATE users SET balance = 0 WHERE balance IS NULL`);
      console.log("✅ Backfilled NULL balances to 0.");
    }

    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log("📋 users table columns:");
    console.table(cols.rows);

  } catch (err) {
    console.error("❌ Migration error:", err && err.stack ? err.stack : err);
    process.exitCode = 2;
  } finally {
    await client.end();
    console.log("✅ Migration script finished.");
  }
})();
