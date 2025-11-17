// delete_admin.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB = path.join(__dirname, 'database.sqlite');
const EMAIL = 'admin@rupayana.com';

const db = new sqlite3.Database(DB, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message || err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run("DELETE FROM users WHERE LOWER(email)=LOWER(?)", [EMAIL], function(err){
    if (err) {
      console.error('Delete error:', err.message || err);
      db.close();
      process.exit(1);
    }
    console.log(`Deleted rows: ${this.changes}`);
    db.get("SELECT COUNT(*) AS c FROM users WHERE LOWER(email)=LOWER(?)", [EMAIL], (e,row) => {
      if (e) console.error('Verify error:', e);
      else console.log('Remaining admin rows:', row.c);
      db.close();
    });
  });
});
