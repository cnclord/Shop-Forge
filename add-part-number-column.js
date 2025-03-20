const sqlite3 = require('sqlite3').verbose();

// Connect to the SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Add part_number column to purchase_orders table if it doesn't exist
  db.get("PRAGMA table_info(purchase_orders)", (err, rows) => {
    if (err) {
      console.error('Error checking table info:', err);
      closeDb();
      return;
    }
    
    // Add the part_number column if it doesn't exist
    db.run("ALTER TABLE purchase_orders ADD COLUMN part_number TEXT", (err) => {
      if (err) {
        // If error contains "duplicate column name", it means the column already exists
        if (err.message.includes('duplicate column name')) {
          console.log('Column part_number already exists');
        } else {
          console.error('Error adding part_number column:', err);
        }
      } else {
        console.log('Added part_number column to purchase_orders table');
      }
      
      closeDb();
    });
  });
});

function closeDb() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
  });
} 