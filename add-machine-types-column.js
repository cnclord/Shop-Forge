const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Add machine_types column to shop_settings table
  db.run(
    "ALTER TABLE shop_settings ADD COLUMN machine_types TEXT DEFAULT '[]'",
    (err) => {
      if (err) {
        // Column might already exist
        console.log('Note: machine_types column may already exist or error occurred:', err.message);
      } else {
        console.log('Added machine_types column to shop_settings table');
      }
      
      // Update existing records with default machine types
      db.run(
        "UPDATE shop_settings SET machine_types = ? WHERE machine_types IS NULL OR machine_types = '[]'",
        [JSON.stringify(['3 Axis Mill', '4th Axis Mill', 'Lathe', 'Outside Vendor', 'Other'])],
        function(err) {
          if (err) {
            console.error('Error updating existing records:', err);
          } else {
            console.log(`Updated ${this.changes} records with default machine types`);
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