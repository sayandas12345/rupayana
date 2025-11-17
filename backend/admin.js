// admin.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB = path.join(__dirname, 'database.sqlite');
const EMAIL = 'admin@gmail.com';

const db = new sqlite3.Database(DB, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message || err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run("UPDATE users SET isAdmin = 1 WHERE LOWER(email)=LOWER(?)", [EMAIL], function(err){
    if (err) {
      console.error('Update error:', err.message || err);
      db.close();
      process.exit(1);
    }
    console.log('Promoted rows:', this.changes);
    db.get("SELECT id,name,email,isAdmin FROM users WHERE LOWER(email)=LOWER(?)", [EMAIL], (e,row) => {
      if (e) console.error('Verify error:', e);
      else console.log('Admin row:', row);
      db.close();
    });
  });
});
