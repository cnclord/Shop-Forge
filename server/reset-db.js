const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
  
  // Drop all tables
  const tables = ['purchase_orders', 'po_items', 'shop_settings', 'parts'];
  let completedDrops = 0;
  
  tables.forEach(table => {
    db.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
      if (err) {
        console.error(`Error dropping ${table} table:`, err);
      } else {
        console.log(`Dropped ${table} table`);
      }
      
      completedDrops++;
      if (completedDrops === tables.length) {
        console.log('All tables dropped');
        process.exit(0);
      }
    });
  });
}); 