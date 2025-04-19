const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

// Get database path from .env or use default
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'database.sqlite');
console.log('Using database at:', dbPath);

// Sample machine configurations
const sampleMachines = [
  {
    id: '1',
    name: 'Mill 1',
    type: 'Mill',
    capacity: 1,
    notes: 'Standard 3-axis mill'
  },
  {
    id: '2',
    name: 'Mill 2',
    type: 'Mill',
    capacity: 1,
    notes: 'Standard 3-axis mill'
  },
  {
    id: '3',
    name: 'Lathe 1',
    type: 'Lathe',
    capacity: 1,
    notes: 'CNC lathe'
  },
  {
    id: '4',
    name: '4-Axis Mill',
    type: '4th Axis Mill',
    capacity: 1,
    notes: '4-axis CNC mill'
  }
];

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Update the machines field in the shop_settings table
  db.run(
    'UPDATE shop_settings SET machines = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM shop_settings ORDER BY id DESC LIMIT 1)',
    [JSON.stringify(sampleMachines)],
    function(err) {
      if (err) {
        console.error('Error updating machine settings:', err);
        closeDb();
        return;
      }
      
      if (this.changes === 0) {
        console.error('No shop settings record found');
        closeDb();
        return;
      }
      
      console.log('Machine settings updated successfully');
      closeDb();
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
    console.log('Script complete');
  });
} 