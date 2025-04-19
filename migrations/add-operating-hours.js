const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Get database path
const dbPath = path.resolve(__dirname, '../database.sqlite');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Backup existing data
  db.get('SELECT * FROM shop_settings ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error backing up shop settings:', err);
      closeDb();
      return;
    }
    
    const backupData = row;
    
    // Drop and recreate the table
    db.run("DROP TABLE IF EXISTS shop_settings", (err) => {
      if (err) {
        console.error('Error dropping shop_settings table:', err);
        closeDb();
        return;
      }
      
      console.log('Dropped shop_settings table');
      
      // Create new shop_settings table with operating_hours
      db.run(`
        CREATE TABLE shop_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hours_per_day INTEGER DEFAULT 8,
          operating_days TEXT DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
          operating_hours TEXT DEFAULT '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":8,"saturday":8,"sunday":8}',
          machines TEXT DEFAULT '[]',
          machine_types TEXT DEFAULT '["3 Axis Mill","4th Axis Mill","Lathe","Outside Vendor"]',
          statuses TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, err => {
        if (err) {
          console.error('Error creating shop_settings table:', err);
          closeDb();
          return;
        }
        
        console.log('Created shop_settings table with operating_hours column');
        
        // Restore data with default operating hours
        if (backupData) {
          const operatingHours = {
            monday: 8,
            tuesday: 8,
            wednesday: 8,
            thursday: 8,
            friday: 8,
            saturday: 8,
            sunday: 8
          };
          
          db.run(`
            INSERT INTO shop_settings (
              hours_per_day, 
              operating_days, 
              operating_hours,
              machines, 
              machine_types, 
              statuses
            ) VALUES (?, ?, ?, ?, ?, ?)
          `, [
            backupData.hours_per_day,
            backupData.operating_days,
            JSON.stringify(operatingHours),
            backupData.machines,
            backupData.machine_types,
            backupData.statuses || '[]'
          ], err => {
            if (err) {
              console.error('Error restoring shop settings:', err);
            } else {
              console.log('Restored shop settings with operating hours');
            }
            closeDb();
          });
        } else {
          // Insert default settings if no backup
          db.run(`
            INSERT INTO shop_settings (
              hours_per_day, 
              operating_days, 
              operating_hours,
              machines, 
              machine_types
            ) VALUES (
              8,
              '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
              '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":8,"saturday":8,"sunday":8}',
              '[]',
              '["3 Axis Mill","4th Axis Mill","Lathe","Outside Vendor"]'
            )
          `, err => {
            if (err) {
              console.error('Error inserting default shop settings:', err);
            } else {
              console.log('Created default shop settings');
            }
            closeDb();
          });
        }
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
    console.log('Migration complete');
  });
} 