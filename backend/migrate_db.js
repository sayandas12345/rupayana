// migrate_db.js - run with: node migrate_db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_FILE, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) return console.error('Failed to open DB:', err);
  console.log('Opened DB:', DB_FILE);
});

function runAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

(async () => {
  try {
    // 1) create tables if missing
    await runAsync(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      phone TEXT,
      role TEXT,
      isAdmin INTEGER DEFAULT 0,
      resetToken TEXT,
      resetExpires INTEGER
    );`);

    await runAsync(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_email TEXT,
      to_email TEXT,
      amount REAL,
      type TEXT,
      details TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );`);

    // 2) ensure columns exist - SQLite cannot drop easily; add if missing
    const pragma = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(users);", (err, rows) => err ? reject(err) : resolve(rows));
    });
    const cols = pragma.map(r => r.name);
    if (!cols.includes('password')) {
      await runAsync('ALTER TABLE users ADD COLUMN password TEXT;');
      console.log('Added column: password');
    }
    if (!cols.includes('isAdmin')) {
      await runAsync('ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0;');
      console.log('Added column: isAdmin');
    }

    // 3) ensure admin exists and isAdmin=1
    const admin = await getAsync("SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1;", ['admin@rupayana.com']);
    if (!admin) {
      await runAsync("INSERT INTO users (name,email,password,phone,isAdmin) VALUES (?,?,?,?,?);",
                    ['Administrator','admin@rupayana.com','adminpass','0000000000',1]);
      console.log("Created admin@rupayana.com with password 'adminpass'");
    } else {
      await runAsync("UPDATE users SET isAdmin=1 WHERE LOWER(email)=LOWER(?)", ['admin@rupayana.com']);
      console.log("Promoted existing admin@rupayana.com to isAdmin=1");
    }

    // 4) show a quick sample
    db.all("SELECT id,name,email,isAdmin FROM users ORDER BY id DESC LIMIT 10;", (err, rows) => {
      if (err) console.error('Select users err', err);
      else console.log('Recent users:', rows);
      db.close();
    });

  } catch (err) {
    console.error('Migration error:', err);
    db.close();
    process.exit(1);
  }
})();
