const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Delete the existing database file
try {
  if (fs.existsSync('./database.sqlite')) {
    fs.unlinkSync('./database.sqlite');
    console.log('Existing database deleted');
  }
} catch (err) {
  console.error('Error deleting database:', err);
  process.exit(1);
}

// Create a new database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error creating database:', err);
    process.exit(1);
  }
  console.log('New database created');
  
  // Create tables with correct schema
  db.serialize(() => {
    // Create purchase_orders table with pdf_path field
    db.run(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL,
        customer TEXT,
        date TEXT,
        due_date TEXT,
        total_amount REAL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        pdf_path TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating purchase_orders table:', err);
      } else {
        console.log('purchase_orders table created successfully');
      }
    });
    
    // Create po_items table
    db.run(`
      CREATE TABLE IF NOT EXISTS po_items (
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
    `, (err) => {
      if (err) {
        console.error('Error creating po_items table:', err);
      } else {
        console.log('po_items table created successfully');
      }
    });
    
    // Close the database connection after all operations are complete
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('All tables created and database closed');
        console.log('Database recreation complete');
      }
    });
  });
}); 