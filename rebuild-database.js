const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('Starting database rebuild...');

// Backup existing database if it exists
const dbPath = './database.sqlite';
if (fs.existsSync(dbPath)) {
  const backupPath = `./database.sqlite.backup.${Date.now()}`;
  console.log(`Backing up existing database to ${backupPath}`);
  fs.copyFileSync(dbPath, backupPath);
  console.log('Backup complete.');
}

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Drop existing tables if they exist
  db.run('DROP TABLE IF EXISTS po_items', err => {
    if (err) {
      console.error('Error dropping po_items table:', err);
      return closeDb();
    }
    
    db.run('DROP TABLE IF EXISTS purchase_orders', err => {
      if (err) {
        console.error('Error dropping purchase_orders table:', err);
        return closeDb();
      }
      
      // Create purchase_orders table with all required fields
      db.run(`
        CREATE TABLE purchase_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          po_number TEXT NOT NULL,
          customer TEXT,
          part_number TEXT,
          revision TEXT,
          date TEXT,
          due_date TEXT,
          total_amount REAL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          pdf_path TEXT,
          machine TEXT,
          quantity INTEGER DEFAULT 1,
          scheduled_start_date TEXT,
          scheduled_end_date TEXT
        )
      `, err => {
        if (err) {
          console.error('Error creating purchase_orders table:', err);
          return closeDb();
        }
        console.log('Created purchase_orders table');
        
        // Create po_items table
        db.run(`
          CREATE TABLE po_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_id INTEGER,
            part_number TEXT,
            revision TEXT,
            description TEXT,
            quantity INTEGER,
            unit_price REAL,
            line_total REAL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
          )
        `, err => {
          if (err) {
            console.error('Error creating po_items table:', err);
            return closeDb();
          }
          console.log('Created po_items table');

          // Create job_reports table
          db.run(`
            CREATE TABLE job_reports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              po_id INTEGER,
              actual_hours REAL,
              parts_completed INTEGER,
              quality_issues TEXT,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
            )
          `, err => {
            if (err) {
              console.error('Error creating job_reports table:', err);
              return closeDb();
            }
            console.log('Created job_reports table');
            
            console.log('Database rebuild complete!');
            closeDb();
          });
        });
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
  });
} 