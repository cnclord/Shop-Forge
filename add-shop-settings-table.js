const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('Starting shop settings table migration...');

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
  
  // Check if the shop_settings table already exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='shop_settings'", (err, row) => {
    if (err) {
      console.error('Error checking for shop_settings table:', err);
      closeDb();
      return;
    }
    
    if (row) {
      console.log('shop_settings table already exists, skipping creation');
      addDefaultSettingsIfNeeded();
      return;
    }
    
    // Create shop_settings table
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
      addDefaultSettingsIfNeeded();
    });
  });
});

function addDefaultSettingsIfNeeded() {
  // Check if there are any settings records
  db.get('SELECT COUNT(*) as count FROM shop_settings', (err, row) => {
    if (err) {
      console.error('Error checking shop settings:', err);
      closeDb();
      return;
    }
    
    if (row.count > 0) {
      console.log('Shop settings already exist, skipping default settings');
      closeDb();
      return;
    }
    
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
}

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