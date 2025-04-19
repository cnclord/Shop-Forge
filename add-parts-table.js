const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('Starting parts table migration...');

// Connect to the database
const dbPath = './database.sqlite';
if (!fs.existsSync(dbPath)) {
  console.error('Database file does not exist');
  process.exit(1);
}

// Backup existing database
const backupPath = `./database.sqlite.backup.${Date.now()}`;
console.log(`Backing up existing database to ${backupPath}`);
fs.copyFileSync(dbPath, backupPath);
console.log('Backup complete.');

// Connect to the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('Connected to database');
  
  // Check if the parts table already exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='parts'", (err, row) => {
    if (err) {
      console.error('Error checking for parts table:', err);
      closeDb();
      return;
    }
    
    if (row) {
      console.log('parts table already exists, skipping creation');
      closeDb();
      return;
    }
    
    // Create parts table
    db.run(`
      CREATE TABLE parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number TEXT NOT NULL,
        revision TEXT,
        description TEXT,
        material_type TEXT,
        material_spec TEXT,
        cycle_time REAL DEFAULT 0,
        setup_time REAL DEFAULT 0,
        machine TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, err => {
      if (err) {
        console.error('Error creating parts table:', err);
        closeDb();
        return;
      }
      
      console.log('Created parts table');
      
      // Insert some example parts
      const sampleParts = [
        {
          part_number: 'BRK-1001',
          revision: 'A',
          description: 'Brake caliper bracket',
          material_type: 'Aluminum',
          material_spec: '6061-T6',
          cycle_time: 15.5,
          setup_time: 45,
          machine: '3 Axis Mill',
          notes: 'Requires heat treatment after machining'
        },
        {
          part_number: 'SHAFT-2050',
          revision: 'B',
          description: 'Drive shaft with keyway',
          material_type: 'Steel',
          material_spec: '1045',
          cycle_time: 8.2,
          setup_time: 20,
          machine: 'Lathe',
          notes: 'Surface finish must be 32 Ra or better'
        },
        {
          part_number: 'HSNG-3214',
          revision: 'C',
          description: 'Bearing housing',
          material_type: 'Steel',
          material_spec: '1018',
          cycle_time: 25,
          setup_time: 60,
          machine: '4th Axis Mill',
          notes: 'Critical dimensions +/- 0.001"'
        }
      ];
      
      // Insert sample parts
      const insertSql = `
        INSERT INTO parts (
          part_number, revision, description, material_type, 
          material_spec, cycle_time, setup_time, machine, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // Use a counter to track insertions
      let counter = 0;
      
      sampleParts.forEach(part => {
        db.run(
          insertSql, 
          [
            part.part_number, 
            part.revision, 
            part.description, 
            part.material_type,
            part.material_spec, 
            part.cycle_time, 
            part.setup_time, 
            part.machine, 
            part.notes
          ],
          (err) => {
            if (err) {
              console.error(`Error inserting sample part ${part.part_number}:`, err);
            } else {
              console.log(`Inserted sample part: ${part.part_number}`);
            }
            
            counter++;
            if (counter === sampleParts.length) {
              closeDb();
            }
          }
        );
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