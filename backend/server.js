// server.js — CORS-safe, responds to OPTIONS, logs FRONTEND_ORIGIN
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());

// FRONTEND ORIGIN from env (must be set in Render)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://rupayana.vercel.app";
console.log("FRONTEND_ORIGIN:", FRONTEND_ORIGIN);

// CORS options — explicitly allow credentials & preflight
const corsOptions = {
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  preflightContinue: false,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // respond to preflight

// root route so GET / won't 404 (helps debug)
app.get("/", (req, res) => res.send("Rupayana backend running."));

// ----------------- DB (Postgres preferred, fallback SQLite) -----------------
let usePostgres = false;
let db = null;

if (process.env.DATABASE_URL) {
  usePostgres = true;
  console.log(">>> USING POSTGRES:", process.env.DATABASE_URL);
  const { Pool } = require("pg");
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
} else {
  console.log(">>> USING SQLITE fallback");
  const sqlite3 = require("sqlite3").verbose();
  const DB_FILE = process.env.DB_FILE || "./database.sqlite";
  db = new sqlite3.Database(DB_FILE);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    password TEXT,
    balance INTEGER DEFAULT 0
  )`);
}

// Helpers
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (usePostgres) db.query(sql, params).then(r => resolve(r.rows)).catch(reject);
    else db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function runExec(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (usePostgres) db.query(sql + " RETURNING *", params).then(r => resolve(r.rows[0] || null)).catch(reject);
    else db.run(sql, params, function(err) { if (err) reject(err); else resolve({ id: this.lastID }); });
  });
}

// Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const exists = await runQuery("SELECT id FROM users WHERE email = $1", [email]).catch(()=>[]);
    if (exists && exists.length) return res.status(409).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await runExec("INSERT INTO users (name,email,phone,password,balance) VALUES ($1,$2,$3,$4,0)", [name||"", email, phone||"", hashed]);

    const userRow = await runQuery("SELECT id,name,email,phone,balance FROM users WHERE email = $1", [email]);
    const user = userRow && userRow[0] ? userRow[0] : null;
    return res.json({ message: "Registered", user });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const rows = await runQuery("SELECT id,name,email,phone,password,balance FROM users WHERE email = $1", [email]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    delete user.password;
    return res.json({ message: "Logged in", user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Logout
app.post("/api/logout", (req, res) => res.json({ success: true }));

// Health
app.get("/api/ping", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running on port", PORT));









