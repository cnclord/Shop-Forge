const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('Starting database alteration...');

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Check if quantity column exists in purchase_orders table
  db.get("PRAGMA table_info(purchase_orders)", (err, rows) => {
    if (err) {
      console.error('Error checking table schema:', err);
      return closeDb();
    }
    
    // Add quantity column if it doesn't exist
    db.run("ALTER TABLE purchase_orders ADD COLUMN quantity INTEGER DEFAULT 1", (err) => {
      if (err) {
        // Column might already exist
        console.log('Note: Quantity column may already exist or error occurred:', err.message);
      } else {
        console.log('Added quantity column to purchase_orders table');
      }
      
      // Update any existing rows to have the default quantity of 1
      db.run("UPDATE purchase_orders SET quantity = 1 WHERE quantity IS NULL", function(err) {
        if (err) {
          console.error('Error updating existing records:', err);
        } else {
          console.log(`Updated ${this.changes} records with default quantity`);
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
  });
} 