const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('Starting status settings migration...');

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
  
  // Add statuses column to shop_settings table
  db.run(`
    ALTER TABLE shop_settings 
    ADD COLUMN statuses TEXT DEFAULT '[]'
  `, err => {
    if (err) {
      console.error('Error adding statuses column:', err);
      closeDb();
      return;
    }
    
    console.log('Added statuses column');
    
    // Update existing records with default statuses
    const defaultStatuses = [
      { id: 'pending', name: 'Pending', color: '#f6e05e' },
      { id: 'in-progress', name: 'In Progress', color: '#63b3ed' },
      { id: 'completed', name: 'Completed', color: '#68d391' }
    ];
    
    db.run(`
      UPDATE shop_settings 
      SET statuses = ?
      WHERE statuses IS NULL OR statuses = '[]'
    `, [JSON.stringify(defaultStatuses)], err => {
      if (err) {
        console.error('Error setting default statuses:', err);
      } else {
        console.log('Default statuses added');
      }
      closeDb();
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