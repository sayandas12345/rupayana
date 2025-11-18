// --------------------------------------------------
// server.js (FINAL WORKING VERSION)
// --------------------------------------------------

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());

// --------------------------------------------------
// CORS FIX (CRITICAL FOR LOGIN/REGISTER)
// --------------------------------------------------
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://rupayana.vercel.app";

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// --------------------------------------------------
// DATABASE: POSTGRES → fallback to SQLITE
// --------------------------------------------------
let usePostgres = false;
let db = null;

if (process.env.DATABASE_URL) {
  console.log(">>> USING POSTGRES:", process.env.DATABASE_URL);

  const { Pool } = require("pg");
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  usePostgres = true;

} else {
  console.log(">>> USING SQLITE (fallback)");

  const sqlite3 = require("sqlite3").verbose();
  const DB_FILE = process.env.DB_FILE || "./database.sqlite";
  db = new sqlite3.Database(DB_FILE);

  // Ensure table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      password TEXT,
      balance INTEGER DEFAULT 0
    )
  `);
}

// --------------------------------------------------
// UNIVERSAL QUERY HELPERS
// --------------------------------------------------
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (usePostgres) {
      db.query(sql, params)
        .then((r) => resolve(r.rows))
        .catch(reject);
    } else {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
}

function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (usePostgres) {
      db.query(sql + " RETURNING *", params)
        .then((r) => resolve(r.rows[0]))
        .catch(reject);
    } else {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    }
  });
}

// --------------------------------------------------
// REGISTER
// --------------------------------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await runQuery("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (exists.length > 0)
      return res.status(409).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    await runExec(
      "INSERT INTO users (name, email, phone, password, balance) VALUES ($1,$2,$3,$4,0)",
      [name, email, phone || "", hashed]
    );

    const user = await runQuery(
      "SELECT id, name, email, phone, balance FROM users WHERE email = $1",
      [email]
    );

    return res.json({ message: "Registered", user: user[0] });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const userRows = await runQuery(
      "SELECT id, name, email, phone, password, balance FROM users WHERE email = $1",
      [email]
    );

    if (userRows.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = userRows[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    delete user.password;
    return res.json({ message: "Logged in", user });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------
app.post("/api/logout", (req, res) => {
  return res.json({ success: true, message: "Logged out" });
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on port", PORT));









