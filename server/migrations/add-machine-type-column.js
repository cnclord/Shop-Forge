const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, '..', 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Add machine_type column to purchase_orders table
  db.run(
    "ALTER TABLE purchase_orders ADD COLUMN machine_type TEXT",
    (err) => {
      if (err) {
        // Column might already exist
        console.log('Note: machine_type column may already exist or error occurred:', err.message);
      } else {
        console.log('Added machine_type column to purchase_orders table');
      }
      
      // Update existing records to set machine_type equal to machine where it exists
      db.run(
        "UPDATE purchase_orders SET machine_type = machine WHERE machine IS NOT NULL",
        function(err) {
          if (err) {
            console.error('Error updating existing records:', err);
          } else {
            console.log(`Updated ${this.changes} records with machine type`);
          }
          
          closeDb();
        }
      );
    }
  );
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