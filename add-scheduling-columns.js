const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Get database path from .env or use default
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
console.log('Using database at:', dbPath);

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Add scheduling columns if they don't exist
  checkAndAddColumns();
});

function checkAndAddColumns() {
  // Get all table columns
  db.all(`PRAGMA table_info(purchase_orders)`, (err, rows) => {
    if (err) {
      console.error('Error checking table columns:', err);
      closeDb();
      return;
    }
    
    // Extract column names
    const columnNames = rows.map(row => row.name);
    console.log('Existing columns:', columnNames);
    
    // Add scheduled_start_date if it doesn't exist
    if (!columnNames.includes('scheduled_start_date')) {
      addColumn('scheduled_start_date', 'TEXT', () => {
        // After adding the first column, add the second if needed
        if (!columnNames.includes('scheduled_end_date')) {
          addColumn('scheduled_end_date', 'TEXT', closeDb);
        } else {
          console.log('Column scheduled_end_date already exists');
          closeDb();
        }
      });
    } else {
      console.log('Column scheduled_start_date already exists');
      
      // Check for the second column
      if (!columnNames.includes('scheduled_end_date')) {
        addColumn('scheduled_end_date', 'TEXT', closeDb);
      } else {
        console.log('Column scheduled_end_date already exists');
        closeDb();
      }
    }
  });
}

function addColumn(columnName, columnType, callback) {
  db.run(`ALTER TABLE purchase_orders ADD COLUMN ${columnName} ${columnType}`, (err) => {
    if (err) {
      console.error(`Error adding ${columnName} column:`, err);
    } else {
      console.log(`Added ${columnName} column to purchase_orders table`);
    }
    
    if (callback) callback();
  });
}

function closeDb() {
  db.close(err => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    console.log('Script complete');
  });
} 