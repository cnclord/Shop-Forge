const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Default statuses
  const defaultStatuses = [
    { id: 'status-1', name: 'Pending', color: '#f6e05e' },
    { id: 'status-2', name: 'In Progress', color: '#63b3ed' },
    { id: 'status-3', name: 'Completed', color: '#68d391' }
  ];

  // Update shop settings with default statuses
  db.run(
    'UPDATE shop_settings SET statuses = ? WHERE statuses IS NULL OR statuses = "[]" OR statuses = ""',
    [JSON.stringify(defaultStatuses)],
    function(err) {
      if (err) {
        console.error('Error updating statuses:', err);
      } else {
        console.log('Updated shop settings with default statuses');
      }
      
      // Close the database connection
      db.close(err => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  );
}); 