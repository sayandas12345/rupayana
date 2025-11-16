// server.js (complete file) - replace your existing server.js with this
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
// const nodemailer = require('nodemailer'); // uncomment if you configure SMTP

const app = express();

// Middlewares
app.use(bodyParser.json());
app.use(cors()); // <-- allow all origins for now (ok for testing). Replace with specific origin in production.
// Health check
app.get('/', (req, res) => res.send('OK'));

// Database setup (sqlite file located in project root)
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
  } else {
    console.log('Connected to SQLite DB:', DB_FILE);
  }
});

// Minimal init: create users table if not exists (adjust columns as needed)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    isAdmin INTEGER DEFAULT 0,
    resetToken TEXT,
    resetExpires INTEGER
  );`, (err) => {
    if (err) console.error('Error creating users table:', err);
  });
});

// Helper: generate token
function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Example routes (adapt to your original logic as needed)

// Register (simple example — in production hash passwords)
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
  stmt.run(name || '', email, password, function (err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Email already exists' });
      console.error('Register error:', err);
      return res.status(500).json({ error: 'DB error' });
    }
    return res.json({ id: this.lastID, name, email });
  });
  stmt.finalize();
});

// Login (simple example — in production compare hashed password)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  db.get('SELECT id, name, email, password FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('Login DB error:', err); return res.status(500).json({ error: 'DB error' });
    }
    if (!row || row.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    // In production return JWT or session id
    return res.json({ id: row.id, name: row.name, email: row.email });
  });
});

// Password reset request: generates token and returns reset link (or sends email if SMTP configured)
app.post('/api/request-reset', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) { console.error(err); return res.status(500).json({ error: 'DB error' }); }
    if (!user) return res.status(404).json({ error: 'No user with that email' });

    const token = genToken();
    const expires = Date.now() + 1000 * 60 * 60; // 1 hour
    db.run('UPDATE users SET resetToken = ?, resetExpires = ? WHERE email = ?', [token, expires, email], (uErr) => {
      if (uErr) { console.error(uErr); return res.status(500).json({ error: 'DB error' }); }

      // FRONTEND_BASE should be set on Render env (e.g., https://your-frontend.vercel.app)
      const FRONTEND_BASE = process.env.FRONTEND_BASE || 'https://your-frontend.vercel.app';
      // Note: reset.html is at root of frontend in the recommended layout (not /frontend/reset.html)
      const resetLink = `${FRONTEND_BASE}/reset.html?token=${token}&email=${encodeURIComponent(email)}`;

      // If you have SMTP configured, send email here. For now return the link in the response for testing:
      // sendEmail(email, 'Reset link', `Click here: ${resetLink}`)

      return res.json({ message: 'Reset token created', resetLink });
    });
  });
});

// Password reset confirm (example)
app.post('/api/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!email || !token || !newPassword) return res.status(400).json({ error: 'Missing fields' });

  db.get('SELECT resetToken, resetExpires FROM users WHERE email = ?', [email], (err, row) => {
    if (err) { console.error(err); return res.status(500).json({ error: 'DB error' }); }
    if (!row) return res.status(404).json({ error: 'User not found' });
    if (row.resetToken !== token || Date.now() > row.resetExpires) return res.status(400).json({ error: 'Invalid or expired token' });

    db.run('UPDATE users SET password = ?, resetToken = NULL, resetExpires = NULL WHERE email = ?', [newPassword, email], (uerr) => {
      if (uerr) { console.error(uerr); return res.status(500).json({ error: 'DB error' }); }
      return res.json({ message: 'Password updated' });
    });
  });
});

// Add any other routes you had here (keep original logic)

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

