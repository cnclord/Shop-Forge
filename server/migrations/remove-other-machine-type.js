const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, '..', 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Get current settings
  db.get('SELECT machine_types FROM shop_settings ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      console.error('Error fetching shop settings:', err);
      closeDb();
      return;
    }
    
    if (!row) {
      console.log('No shop settings found');
      closeDb();
      return;
    }
    
    try {
      // Parse current machine types
      let machineTypes = JSON.parse(row.machine_types || '[]');
      console.log('Current machine types:', machineTypes);
      
      // Remove 'Other' from the list
      machineTypes = machineTypes.filter(type => type !== 'Other');
      console.log('Updated machine types:', machineTypes);
      
      // Update the settings
      db.run(
        'UPDATE shop_settings SET machine_types = ?, updated_at = CURRENT_TIMESTAMP',
        [JSON.stringify(machineTypes)],
        function(err) {
          if (err) {
            console.error('Error updating machine types:', err);
          } else {
            console.log('Successfully removed "Other" from machine types');
          }
          closeDb();
        }
      );
    } catch (e) {
      console.error('Error processing machine types:', e);
      closeDb();
    }
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