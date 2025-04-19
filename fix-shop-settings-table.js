const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('Starting shop settings table fix...');

// Connect to the database
const dbPath = './database.sqlite';
if (!fs.existsSync(dbPath)) {
  console.error('Database file does not exist');
  process.exit(1);
}

// Backup existing database
const backupPath = `./database.sqlite.backup.${Date.now()}`;
console.log(`Backing up existing database to ${backupPath}`);
fs.copyFileSync(dbPath, backupPath);
console.log('Backup complete.');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Drop the shop_settings table if it exists
  db.run("DROP TABLE IF EXISTS shop_settings", (err) => {
    if (err) {
      console.error('Error dropping shop_settings table:', err);
      closeDb();
      return;
    }
    
    console.log('Dropped shop_settings table if it existed');
    
    // Create a new shop_settings table
    db.run(`
      CREATE TABLE shop_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hours_per_day INTEGER DEFAULT 8,
        operating_days TEXT DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
        machines TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, err => {
      if (err) {
        console.error('Error creating shop_settings table:', err);
        closeDb();
        return;
      }
      
      console.log('Created shop_settings table');
      
      // Insert default settings
      db.run(`
        INSERT INTO shop_settings (hours_per_day, operating_days, machines)
        VALUES (8, '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}', '[]')
      `, err => {
        if (err) {
          console.error('Error inserting default shop settings:', err);
        } else {
          console.log('Default shop settings created');
        }
        closeDb();
      });
    });
  });
});

function closeDb() {
  db.close(err => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    console.log('Migration complete');
  });
} 