// server.js — Postgres-aware startup migration (adds balance column if missing)
// plus CORS, auth routes, sqlite fallback.
// Replace your current server.js with this file and push to Render.

require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());
app.use(cookieParser());

// Simple dynamic CORS (you can lock this down by setting FRONTEND_ORIGIN env later)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use((req, res, next) => {
  const origin = req.headers.origin || FRONTEND_ORIGIN;
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).send("");
  next();
});

app.get("/", (req, res) => res.send("Rupayana backend running."));

// ---------- DB Initialization (Postgres preferred, fallback SQLite) ----------
let usePostgres = false;
let pgClient = null;
let sqliteDb = null;

async function initDbAndMigrate() {
  if (process.env.DATABASE_URL) {
    // Use Postgres
    usePostgres = true;
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    pgClient = pool; // we will use pool.query(...)
    console.log(">>> USING POSTGRES:", process.env.DATABASE_URL);

    // Run migration at startup: add balance column if missing
    try {
      console.log("Running DB migration: ensure 'balance' column exists...");
      // ALTER TABLE ... ADD COLUMN IF NOT EXISTS is safe & idempotent
      await pgClient.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance integer DEFAULT 0`);
      // Ensure no nulls
      await pgClient.query(`UPDATE users SET balance = 0 WHERE balance IS NULL`);
      console.log("Migration successful: 'balance' column present (Postgres).");
    } catch (err) {
      console.error("Migration (Postgres) error:", err && err.stack ? err.stack : err);
      // do not throw — continue so service can run (but log will show error)
    }
  } else {
    // Use SQLite fallback
    usePostgres = false;
    const sqlite3 = require("sqlite3").verbose();
    const DB_FILE = process.env.DB_FILE || "./database.sqlite";
    sqliteDb = new sqlite3.Database(DB_FILE, (err) => {
      if (err) console.error("SQLite open error:", err);
      else console.log(">>> USING SQLITE fallback DB:", DB_FILE);
    });

    // Ensure users table has balance column in sqlite (create table if not exists)
    sqliteDb.serialize(() => {
      // create table if not exists with balance column included
      sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        password TEXT,
        balance INTEGER DEFAULT 0
      )`, (err) => {
        if (err) console.error("SQLite create table error:", err);
        else console.log("SQLite users table is ready (includes balance).");
      });
    });
  }
}

// Run the DB init/migration before the app listens
initDbAndMigrate().catch(err => {
  console.error("initDbAndMigrate error:", err && err.stack ? err.stack : err);
});

// ---------- Helper query functions ----------
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (usePostgres) {
      pgClient.query(sql, params).then(r => resolve(r.rows)).catch(reject);
    } else {
      sqliteDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    }
  });
}

function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (usePostgres) {
      // For INSERT/UPDATE in postgres, return first row if any
      pgClient.query(sql + " RETURNING *", params).then(r => resolve(r.rows[0] || null)).catch(reject);
    } else {
      sqliteDb.run(sql, params, function(err) {
        if (err) return reject(err);
        return resolve({ id: this.lastID });
      });
    }
  });
}

// ---------- Auth routes (register/login/logout) ----------
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    // check existing
    const exists = await runQuery("SELECT id FROM users WHERE email = $1", [email]).catch(async () => {
      // For sqlite the placeholder is '?', so adapt
      return usePostgres ? [] : await runQuery("SELECT id FROM users WHERE email = ?", [email]);
    });

    if (exists && exists.length) return res.status(409).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    if (usePostgres) {
      await runExec("INSERT INTO users (name,email,phone,password,balance) VALUES ($1,$2,$3,$4,0)", [name||"", email, phone||"", hashed]);
      const userRow = await runQuery("SELECT id,name,email,phone,balance FROM users WHERE email = $1", [email]);
      const user = userRow && userRow[0] ? userRow[0] : null;
      return res.json({ message: "Registered", user });
    } else {
      await runExec("INSERT INTO users (name,email,phone,password,balance) VALUES (?,?,?,?,0)", [name||"", email, phone||"", hashed]);
      const userRow = await runQuery("SELECT id,name,email,phone,balance FROM users WHERE email = ?", [email]);
      const user = userRow && userRow[0] ? userRow[0] : null;
      return res.json({ message: "Registered", user });
    }
  } catch (err) {
    console.error("REGISTER ERROR:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const rows = await runQuery("SELECT id,name,email,phone,password,balance FROM users WHERE email = $1", [email])
      .catch(async () => {
        // sqlite uses ? placeholders
        return usePostgres ? [] : await runQuery("SELECT id,name,email,phone,password,balance FROM users WHERE email = ?", [email]);
      });

    if (!rows || rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    if (!user.password) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    delete user.password;
    return res.json({ message: "Logged in", user });
  } catch (err) {
    console.error("LOGIN ERROR:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/logout", (req, res) => res.json({ success: true }));
app.get("/api/ping", (req, res) => res.json({ ok: true }));

// ---------- Start server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on port", PORT));









