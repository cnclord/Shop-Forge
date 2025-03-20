const sqlite3 = require('sqlite3').verbose();

// Connect to the SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Add machine column to purchase_orders table if it doesn't exist
  db.get("PRAGMA table_info(purchase_orders)", (err, rows) => {
    if (err) {
      console.error('Error checking table info:', err);
      closeDb();
      return;
    }
    
    // Add the machine column if it doesn't exist
    db.run("ALTER TABLE purchase_orders ADD COLUMN machine TEXT", (err) => {
      if (err) {
        // If error contains "duplicate column name", it means the column already exists
        if (err.message.includes('duplicate column name')) {
          console.log('Column machine already exists');
        } else {
          console.error('Error adding machine column:', err);
        }
      } else {
        console.log('Added machine column to purchase_orders table');
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