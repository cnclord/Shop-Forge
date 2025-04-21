const express = require('express');
const multer = require('multer');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { parsePOPdf } = require('./utils/pdfParser');
require('dotenv').config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Set port
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
  try {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
    console.log('Created uploads directory at:', uploadsDir);
  } catch (err) {
    console.error('Failed to create uploads directory:', err);
  }
}

// Configure file storage for uploaded POs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// SQLite connection setup
const db = new sqlite3.Database(process.env.DATABASE_PATH || './database.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDb();
  }
});

// Initialize database tables
function initDb() {
  // Create purchase_orders table with scheduling fields
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL,
      customer TEXT NOT NULL,
      date TEXT,
      due_date TEXT,
      total_amount REAL,
      part_number TEXT,
      revision TEXT,
      pdf_path TEXT,
      status TEXT DEFAULT 'pending',
      machine TEXT,
      scheduled_start_date TEXT,
      scheduled_end_date TEXT,
      quantity INTEGER DEFAULT 1,
      operator_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating purchase_orders table:', err);
    } else {
      console.log('Purchase Orders table checked/created.');
      // Check columns after table is potentially created/verified
      checkAndAddColumns();
    }
  });
  
  // Create po_items table
  db.run(`
    CREATE TABLE IF NOT EXISTS po_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER,
      part_number TEXT,
      revision TEXT,
      description TEXT,
      quantity INTEGER,
      unit_price REAL,
      line_total REAL,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating po_items table:', err);
    else console.log('PO Items table checked/created.');
  });
  
  // Create shop_settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS shop_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hours_per_day INTEGER DEFAULT 8,
      operating_days TEXT DEFAULT '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
      operating_hours TEXT DEFAULT '{"monday_start":9,"monday_end":17,"tuesday_start":9,"tuesday_end":17,"wednesday_start":9,"wednesday_end":17,"thursday_start":9,"thursday_end":17,"friday_start":9,"friday_end":17,"saturday_start":9,"saturday_end":17,"sunday_start":9,"sunday_end":17}',
      machines TEXT DEFAULT '[]',
      machine_types TEXT DEFAULT '["3 Axis Mill","4th Axis Mill","Lathe","Outside Vendor"]',
      statuses TEXT DEFAULT '[]',
      operators TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating shop_settings table:', err);
    } else {
      console.log('Shop Settings table checked/created.');
      checkAndInsertDefaultSettings();
    }
  });
  
  // Create parts table
  db.run(`
    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL UNIQUE,
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
  `, (err) => {
    if (err) console.error('Error creating parts table:', err);
    else console.log('Parts table checked/created.');
  });
}

// Function to check and add missing columns (idempotent)
function checkAndAddColumns() {
  const columnsToAdd = [
    { table: 'purchase_orders', column: 'quantity', definition: 'INTEGER DEFAULT 1' },
    { table: 'purchase_orders', column: 'operator_id', definition: 'TEXT' },
    { table: 'shop_settings', column: 'operators', definition: 'TEXT DEFAULT \'[]\'' },
  ];

  columnsToAdd.forEach(colInfo => {
    db.all(`PRAGMA table_info(${colInfo.table})`, (err, rows) => {
      if (err) {
        console.error(`Error getting table info for ${colInfo.table}:`, err);
        return;
      }
      const columnExists = rows.some(row => row.name === colInfo.column);
      if (!columnExists) {
        db.run(`ALTER TABLE ${colInfo.table} ADD COLUMN ${colInfo.column} ${colInfo.definition}`, (err) => {
          if (err) {
            console.error(`Error adding column ${colInfo.column} to ${colInfo.table}:`, err);
          } else {
            console.log(`Added column ${colInfo.column} to ${colInfo.table}`);
            // Specific post-add logic if needed, e.g., updating NULL values
            if (colInfo.table === 'purchase_orders' && colInfo.column === 'quantity') {
              db.run("UPDATE purchase_orders SET quantity = 1 WHERE quantity IS NULL");
            }
          }
        });
      }
    });
  });
}

// Function to check and insert default settings if none exist
function checkAndInsertDefaultSettings() {
    db.get('SELECT COUNT(*) as count FROM shop_settings', (err, row) => {
    if (err) {
      console.error('Error checking shop settings:', err);
      return;
    }

    if (row.count === 0) {
      db.run(`
        INSERT INTO shop_settings (hours_per_day, operating_days, operating_hours, machines, machine_types, statuses, operators)
        VALUES (8,
          '{"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}',
          '{"monday_start":9,"monday_end":17,"tuesday_start":9,"tuesday_end":17,"wednesday_start":9,"wednesday_end":17,"thursday_start":9,"thursday_end":17,"friday_start":9,"friday_end":17,"saturday_start":9,"saturday_end":17,"sunday_start":9,"sunday_end":17}',
          '[]',
          '["3 Axis Mill","4th Axis Mill","Lathe","Outside Vendor"]',
          '[{"name":"Pending","color":"#808080"},{"name":"In Progress","color":"#FFA500"},{"name":"Completed","color":"#008000"},{"name":"On Hold","color":"#FFFF00"}]',
          '[]'
        )
      `, err => {
        if (err) {
          console.error('Error inserting default shop settings:', err);
        } else {
          console.log('Default shop settings created');
        }
      });
    }
  });
}

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Save edited PO data endpoint
app.put('/api/save-po', (req, res) => {
  try {
    const { poNumber, customer, dueDate, part_number, revision, quantity, pdf_path, machine } = req.body;
    
    // Validate required fields
    if (!poNumber || !customer) {
      return res.status(400).json({ error: 'PO Number and Customer are required fields' });
    }
    
    // Look up the PO by the PO number
    db.get('SELECT id FROM purchase_orders WHERE po_number = ?', [poNumber], (err, row) => {
      if (err) {
        console.error('Error finding PO:', err);
        return res.status(500).json({ error: 'Database error while looking up PO' });
      }
      
      // If no PO exists with that number, create a new one
      if (!row) {
        db.run(
          'INSERT INTO purchase_orders (po_number, customer, due_date, part_number, revision, pdf_path, machine, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [poNumber, customer, dueDate, part_number, revision, pdf_path, machine, quantity || 1],
          function(err) {
            if (err) {
              console.error('Error creating new PO:', err);
              return res.status(500).json({ error: 'Failed to create new PO' });
            }
            
            const poId = this.lastID;
            
            // Create at least one line item if this is a new PO
            db.run(
              'INSERT INTO po_items (po_id, part_number, revision, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [poId, part_number || 'Unknown', revision || '', 'Manually added', quantity || 1, 0, 0],
              function(err) {
                if (err) {
                  console.error('Error creating line item:', err);
                  // Don't fail the whole request if line item creation has an issue
                }
                
                res.status(201).json({
                  message: 'New PO created successfully',
                  id: poId
                });
              }
            );
          }
        );
      } else {
        // Update existing PO
        const poId = row.id;
        
        db.run(
          'UPDATE purchase_orders SET po_number = ?, customer = ?, due_date = ?, part_number = ?, revision = ?, machine = ?, quantity = ? WHERE id = ?',
          [poNumber, customer, dueDate, part_number, revision, machine, quantity || 1, poId],
          function(err) {
            if (err) {
              console.error('Error updating PO:', err);
              return res.status(500).json({ error: 'Failed to update PO' });
            }
            
            // Update the first line item with the new part number and revision
            db.run(
              'UPDATE po_items SET part_number = ?, revision = ?, quantity = ? WHERE po_id = ? AND id = (SELECT MIN(id) FROM po_items WHERE po_id = ?)',
              [part_number, revision, quantity, poId, poId],
              function(err) {
                if (err) {
                  console.error('Error updating line item:', err);
                  // Don't fail the whole request if line item update has an issue
                }
                
                res.status(200).json({
                  message: 'PO updated successfully',
                  id: poId
                });
              }
            );
          }
        );
      }
    });
  } catch (error) {
    console.error('Error saving PO:', error);
    res.status(500).json({ error: 'Failed to save PO', details: error.message });
  }
});

// PO Upload endpoint
app.post('/api/upload-po', upload.single('poFile'), async (req, res) => {
  try {
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Log file information
    console.log('Uploaded file:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Get the uploaded file path
    const pdfPath = req.file.path;
    // Store just the filename rather than the full path
    const pdfFilename = path.basename(req.file.path);
    
    try {
      // Parse the PDF
      const fileBuffer = fs.readFileSync(pdfPath);
      const extractedData = await parsePOPdf(fileBuffer);
      
      console.log('Extracted data:', JSON.stringify(extractedData, null, 2));
      
      // Set default values for any missing data
      const poNumber = extractedData.poNumber || extractedData.poNumber === 'Unknown' ? 
                      req.file.originalname.replace(/\.[^/.]+$/, "") : extractedData.poNumber;
      const customer = extractedData.customer || 'Thorlabs Inc';
      // Use current date if no date extracted
      const date = extractedData.date || new Date().toISOString().split('T')[0];
      const dueDate = extractedData.dueDate || null;
      const totalAmount = extractedData.totalAmount || 0;
      const partNumber = extractedData.part_number || null;
      const revision = extractedData.revision || null;
      
      // Instead of inserting into the database here, just return the extracted data
      // for the user to review and edit before saving
      res.status(200).json({
        message: 'PDF processed successfully',
        data: {
          ...extractedData,
          pdf_path: pdfFilename
        }
      });
    } catch (parseError) {
      console.error('PDF parsing error:', parseError);
      
      // Return a minimal data structure for the user to fill in
      res.status(200).json({
        message: 'PDF processing had issues, please fill in the data manually',
        data: {
          poNumber: req.file.originalname.replace(/\.[^/.]+$/, ""),
          customer: 'Unknown',
          date: new Date().toISOString().split('T')[0],
          dueDate: null,
          totalAmount: 0,
          part_number: null,
          revision: null,
          pdf_path: pdfFilename
        }
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process upload', details: error.message });
  }
});

// Get all purchase orders with part data
app.get('/api/purchase-orders', (req, res) => {
  // Get all purchase orders
  db.all(
    `SELECT po.* FROM purchase_orders po ORDER BY po.created_at DESC`,
    async (err, rows) => {
      if (err) {
        console.error('Error fetching purchase orders:', err);
        return res.status(500).json({ error: 'Failed to fetch purchase orders' });
      }

      // console.log('Raw PO data from database:', rows); // Log raw data if needed

      // For each PO, try to fetch the associated part data
      try {
        const enrichedRows = await Promise.all(rows.map(async (po) => {
          // Initialize part_data
          let partData = null;

          // If the PO has a part number, try to get the part data
          if (po.part_number) {
            partData = await new Promise((resolve) => {
              db.get(
                'SELECT * FROM parts WHERE part_number = ? AND (revision = ? OR revision IS NULL OR ? IS NULL)', // Match revision or if PO revision is null
                [po.part_number, po.revision, po.revision],
                (err, part) => {
                  if (err || !part) {
                    if (err) console.error(`Error fetching part ${po.part_number} rev ${po.revision}:`, err);
                    resolve(null); // Resolve with null if error or not found
                  } else {
                    resolve({ // Resolve with part data
                      setup_time: parseFloat(part.setup_time) || 0,
                      cycle_time: parseFloat(part.cycle_time) || 0,
                      machine: part.machine
                    });
                  }
                }
              );
            });
          }

          // Calculate total time required using part data if available, otherwise use default logic
          let totalTimeRequired = 0; // Default to 0, calculation happens below
          if (partData) {
              const setupTime = partData.setup_time;
              const cycleTime = partData.cycle_time;
              const quantity = parseInt(po.quantity) || 1;
              totalTimeRequired = setupTime + (cycleTime * quantity);
          } else {
              // Define default calculation logic if part data is missing
              // Example: Default setup 0.25hr, default cycle 0.5hr
              const defaultSetup = 0.25;
              const defaultCycle = 0.5;
              const quantity = parseInt(po.quantity) || 1;
              totalTimeRequired = defaultSetup + (defaultCycle * quantity);
          }


          // Return the PO object with added part_data and total_time_required
          return {
            ...po,
            total_time_required: totalTimeRequired,
            part_data: partData // Include fetched part data (or null)
          };
        }));

        // console.log('Sending enriched PO data:', enrichedRows); // Log enriched data if needed
        res.json(enrichedRows);
      } catch (error) {
        console.error('Error enriching purchase orders:', error);
        res.status(500).json({ error: 'Failed to process purchase orders' });
      }
    }
  );
});

// Get a specific purchase order with line items
app.get('/api/purchase-orders/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM purchase_orders WHERE id = ?', [id], (err, po) => {
    if (err) {
      console.error('Error fetching purchase order:', err);
      return res.status(500).json({ error: 'Failed to fetch purchase order details' });
    }
    
    if (!po) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    
    db.all('SELECT * FROM po_items WHERE po_id = ?', [id], (err, items) => {
      if (err) {
        console.error('Error fetching line items:', err);
        return res.status(500).json({ error: 'Failed to fetch line items' });
      }
      
      res.status(200).json({
        ...po,
        items: items
      });
    });
  });
});

// Update PO information
app.put('/api/purchase-orders/:id', (req, res) => {
  const { id } = req.params;
  const { po_number, customer, part_number, revision, due_date, status, machine, quantity } = req.body;
  
  console.log('Received PO update request:');
  console.log('Machine type:', machine);
  console.log('Full update data:', req.body);
  
  // First get shop settings to validate machine type
  db.get('SELECT machine_types FROM shop_settings ORDER BY id DESC LIMIT 1', [], (err, settings) => {
    if (err) {
      console.error('Error fetching shop settings:', err);
      return res.status(500).json({ error: 'Failed to validate machine type' });
    }

    let machineTypes = [];
    try {
      machineTypes = JSON.parse(settings.machine_types || '[]');
      console.log('Available machine types from settings:', machineTypes);
    } catch (e) {
      console.error('Error parsing machine types:', e);
    }

    // Validate machine type if one is provided
    if (machine && !machineTypes.includes(machine)) {
      console.error('Invalid machine type received:', machine);
      console.error('Available types:', machineTypes);
      return res.status(400).json({ error: 'Invalid machine type' });
    }
    
    // If part number exists, validate machine type against part requirements
    if (part_number && machine) {
      db.get(
        'SELECT machine FROM parts WHERE part_number = ? AND (revision = ? OR revision IS NULL)',
        [part_number, revision || ''],
        (err, part) => {
          if (err) {
            console.error('Error checking part machine type:', err);
            return res.status(500).json({ error: 'Failed to validate part machine type' });
          }
          
          if (part && part.machine && part.machine !== machine) {
            console.error('Machine type mismatch:', {
              required: part.machine,
              selected: machine
            });
            return res.status(400).json({ 
              error: `This part requires a ${part.machine}. Please select the correct machine type.`
            });
          }
          
          updatePurchaseOrder();
        }
      );
    } else {
      updatePurchaseOrder();
    }
    
    function updatePurchaseOrder() {
      console.log('Updating PO with machine type:', machine);
      
      // Update the purchase order
      db.run(
        'UPDATE purchase_orders SET po_number = ?, customer = ?, part_number = ?, revision = ?, due_date = ?, status = ?, machine = ?, quantity = ? WHERE id = ?',
        [po_number, customer, part_number || null, revision || null, due_date, status, machine || null, quantity || 1, id],
        function(err) {
          if (err) {
            console.error('Error updating PO:', err);
            return res.status(500).json({ error: 'Failed to update purchase order' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Purchase order not found' });
          }
          
          res.status(200).json({ message: 'Purchase order updated successfully' });
        }
      );
    }
  });
});

// Update PO scheduling information
app.patch('/api/purchase-orders/:id', (req, res) => {
  const { id } = req.params;
  const { machine, scheduled_start_date, scheduled_end_date, status, operator_id } = req.body;

  console.log('PATCH request received:', {
    id,
    body: req.body,
    operator_id: operator_id
  });

  // Validate status if provided
  if (status) {
    db.get('SELECT statuses FROM shop_settings ORDER BY id DESC LIMIT 1', [], (err, settings) => {
      if (err) {
        console.error('Error fetching shop settings for status validation:', err);
        return res.status(500).json({ error: 'Failed to validate status' });
      }

      if (!settings || !settings.statuses) {
         console.error('Statuses not found in settings');
         return res.status(500).json({ error: 'Shop status settings not configured' });
      }

      let validStatuses = [];
      try {
        validStatuses = JSON.parse(settings.statuses || '[]');
        if (!Array.isArray(validStatuses)) throw new Error('Statuses is not an array');
      } catch (e) {
        console.error('Error parsing statuses from settings:', e);
        return res.status(500).json({ error: 'Failed to parse status settings' });
      }

      const isValidStatus = validStatuses.some(s => s && typeof s.name === 'string' && s.name.toLowerCase() === status.toLowerCase());
      if (!isValidStatus) {
        console.error('Invalid status received:', status);
        console.error('Available statuses:', validStatuses.map(s => s.name));
        return res.status(400).json({ error: `Invalid status: ${status}` });
      }

      // Status is valid, proceed to update
      performUpdate();
    });
  } else {
    // No status update requested, proceed directly
    performUpdate();
  }

  function performUpdate() {
    const updateFields = [];
    const updateValues = [];

    // Use hasOwnProperty to check if the key exists in the request body,
    // allowing null values to be set explicitly.
    if (req.body.hasOwnProperty('machine')) {
      updateFields.push('machine = ?');
      updateValues.push(machine === 'unassigned' ? null : machine); // Handle 'unassigned' machine
    }
    if (req.body.hasOwnProperty('scheduled_start_date')) {
      updateFields.push('scheduled_start_date = ?');
      updateValues.push(scheduled_start_date); // Allow null
    }
    if (req.body.hasOwnProperty('scheduled_end_date')) {
      updateFields.push('scheduled_end_date = ?');
      updateValues.push(scheduled_end_date); // Allow null
    }
    if (req.body.hasOwnProperty('status')) {
      updateFields.push('status = ?');
      updateValues.push(status); // Already validated
    }
    // Add operator_id update logic
    if (req.body.hasOwnProperty('operator_id')) {
      updateFields.push('operator_id = ?');
      updateValues.push(operator_id === 'UNASSIGN' ? null : operator_id);
    }

    if (updateFields.length === 0) {
      // Nothing to update
      return res.status(200).json({ message: 'No fields provided for update' });
    }

    // Add the ID to the values array for the WHERE clause
    updateValues.push(id);

    const query = `UPDATE purchase_orders SET ${updateFields.join(', ')} WHERE id = ?`;

    console.log('Executing PATCH query:', {
      query,
      values: updateValues
    });

    db.run(query, updateValues, function(err) {
      if (err) {
        console.error('Error updating PO via PATCH:', err);
        return res.status(500).json({ error: 'Failed to update purchase order schedule' });
      }

      if (this.changes === 0) {
        // Check if the PO actually exists
         db.get('SELECT id FROM purchase_orders WHERE id = ?', [id], (err, row) => {
           if (!row) {
             return res.status(404).json({ error: 'Purchase order not found' });
           } else {
             // PO exists, but nothing changed (maybe same values were sent?)
             return res.status(200).json({ message: 'Purchase order found, but no changes applied (values might be the same)' });
           }
         });
      } else {
         // Get the updated record to return
         db.get('SELECT * FROM purchase_orders WHERE id = ?', [id], (err, updatedPO) => {
           if (err) {
             console.error('Error fetching updated PO:', err);
             return res.status(200).json({ message: 'Purchase order schedule updated successfully' });
           }
           console.log('Updated PO:', updatedPO);
           res.status(200).json({ 
             message: 'Purchase order schedule updated successfully',
             purchaseOrder: updatedPO
           });
         });
      }
    });
  }
});

// Batch update schedule
app.put('/api/schedule/batch', (req, res) => {
  const { updates } = req.body;
  
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Invalid updates format' });
  }

  console.log(`Processing batch update for ${updates.length} jobs`);

  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    let success = true;
    let completed = 0;
    
    // Process each update
    updates.forEach((update) => {
      const { id, machine, scheduled_start_date, scheduled_end_date } = update;
      
      console.log(`Updating job ${id} with machine: ${machine}, start: ${scheduled_start_date}, end: ${scheduled_end_date}`);
      
      db.run(
        'UPDATE purchase_orders SET machine = ?, scheduled_start_date = ?, scheduled_end_date = ? WHERE id = ?',
        [machine || null, scheduled_start_date || null, scheduled_end_date || null, id],
        function(err) {
          if (err) {
            console.error('Error updating PO schedule:', err);
            success = false;
          } else if (this.changes === 0) {
            console.warn(`No row updated for job ID: ${id}`);
            // Don't mark as failure, just log it
          } else {
            console.log(`Successfully updated job ID: ${id}`);
          }
          
          completed++;
          
          // If all updates are processed, commit or rollback
          if (completed === updates.length) {
            if (success) {
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to commit schedule updates' });
                }
                console.log(`Successfully committed schedule updates for ${completed} jobs`);
                res.status(200).json({ message: `Successfully updated ${completed} jobs` });
              });
            } else {
              db.run('ROLLBACK');
              res.status(500).json({ error: 'Failed to update some jobs' });
            }
          }
        }
      );
    });
  });
});

// Update line item information
app.put('/api/po-items/:id', (req, res) => {
  const { id } = req.params;
  const { part_number, revision, description, quantity, unit_price, line_total, status } = req.body;
  
  db.run(
    'UPDATE po_items SET part_number = ?, revision = ?, description = ?, quantity = ?, unit_price = ?, line_total = ?, status = ? WHERE id = ?',
    [part_number, revision, description, quantity, unit_price, line_total, status, id],
    function(err) {
      if (err) {
        console.error('Error updating line item:', err);
        return res.status(500).json({ error: 'Failed to update line item' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Line item not found' });
      }
      
      res.status(200).json({ message: 'Line item updated successfully' });
    }
  );
});

// Delete PO and related items
app.delete('/api/purchase-orders/:id', (req, res) => {
  const { id } = req.params;
  
  // Begin transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Delete related line items
    db.run('DELETE FROM po_items WHERE po_id = ?', [id], function(err) {
      if (err) {
        console.error('Error deleting line items:', err);
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Failed to delete purchase order items' });
      }
      
      // Delete the purchase order
      db.run('DELETE FROM purchase_orders WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Error deleting purchase order:', err);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Failed to delete purchase order' });
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return res.status(404).json({ error: 'Purchase order not found' });
        }
        
        // Commit the transaction
        db.run('COMMIT');
        res.status(200).json({ message: 'Purchase order deleted successfully' });
      });
    });
  });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
}

// Shop Settings API Endpoints
app.get('/api/shop-settings', (req, res) => {
  db.get('SELECT * FROM shop_settings ORDER BY id DESC LIMIT 1', (err, row) => {
    if (err) {
      console.error('Error retrieving shop settings:', err);
      return res.status(500).json({ error: 'Failed to retrieve shop settings' });
    }

    if (!row) {
      // If no settings exist, maybe return defaults or 404
      // Let's insert defaults if they are missing and try again or return 404.
      // For simplicity, returning 404 here. Ensure initDb handles default creation.
      return res.status(404).json({ error: 'No shop settings found' });
    }

    try {
      // Parse JSON strings to objects, providing defaults if parsing fails or field is null
      const safeParse = (jsonString, defaultValue = []) => {
        try {
          if (jsonString === null || jsonString === undefined) return defaultValue;
          const parsed = JSON.parse(jsonString);
          // Ensure specific types if needed (e.g., array for machines, statuses, operators)
          if (defaultValue && Array.isArray(defaultValue) && !Array.isArray(parsed)) {
              console.warn('Parsed JSON is not an array as expected, returning default:', jsonString);
              return defaultValue;
          }
          // Add more specific type checks if necessary
          return parsed;
        } catch (e) {
          console.error('Error parsing JSON string, returning default:', jsonString, e);
          return defaultValue;
        }
      };

      const settings = {
        id: row.id, // Include id if needed on frontend
        hoursPerDay: row.hours_per_day || 8,
        operatingDays: safeParse(row.operating_days, {"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false}),
        operatingHours: safeParse(row.operating_hours, {"monday_start":9,"monday_end":17,"tuesday_start":9,"tuesday_end":17,"wednesday_start":9,"wednesday_end":17,"thursday_start":9,"thursday_end":17,"friday_start":9,"friday_end":17,"saturday_start":9,"saturday_end":17,"sunday_start":9,"sunday_end":17}),
        machines: safeParse(row.machines, []),
        machineTypes: safeParse(row.machine_types, []),
        statuses: safeParse(row.statuses, []),
        operators: safeParse(row.operators, []) // Parse operators
      };

      res.status(200).json(settings);
    } catch (parseError) { // This outer catch might be redundant with safeParse, but keep for safety
      console.error('Unexpected error processing shop settings:', parseError);
      res.status(500).json({ error: 'Failed to process shop settings data' });
    }
  });
});

// Update Shop Settings (now POST, previously PUT/POST logic combined)
app.post('/api/shop-settings', (req, res) => {
  try {
    // Include operators in destructuring
    const { hoursPerDay, operatingDays, operatingHours, machines, machineTypes, statuses, operators } = req.body;

    // Log received data for debugging
    console.log('Received shop settings update:', req.body);

    // Basic validation (expand as needed)
    if (hoursPerDay === undefined || !operatingDays || !operatingHours || !machines || !machineTypes || !statuses || !operators) {
      console.error('Missing fields in shop settings update:', req.body);
      return res.status(400).json({ error: 'One or more required settings fields are missing' });
    }

    // Validate data types and provide defaults if needed
    const validatedData = {
      hoursPerDay: typeof hoursPerDay === 'number' ? hoursPerDay : 8,
      operatingDays: typeof operatingDays === 'object' ? operatingDays : {"monday":true,"tuesday":true,"wednesday":true,"thursday":true,"friday":true,"saturday":false,"sunday":false},
      operatingHours: typeof operatingHours === 'object' ? operatingHours : {"monday_start":9,"monday_end":17,"tuesday_start":9,"tuesday_end":17,"wednesday_start":9,"wednesday_end":17,"thursday_start":9,"thursday_end":17,"friday_start":9,"friday_end":17,"saturday_start":9,"saturday_end":17,"sunday_start":9,"sunday_end":17},
      machines: Array.isArray(machines) ? machines : [],
      machineTypes: Array.isArray(machineTypes) ? machineTypes : [],
      statuses: Array.isArray(statuses) ? statuses : [],
      operators: Array.isArray(operators) ? operators : []
    };

    // Stringify objects/arrays for database storage
    const operatingDaysJSON = JSON.stringify(validatedData.operatingDays);
    const operatingHoursJSON = JSON.stringify(validatedData.operatingHours);
    const machinesJSON = JSON.stringify(validatedData.machines);
    const machineTypesJSON = JSON.stringify(validatedData.machineTypes);
    const statusesJSON = JSON.stringify(validatedData.statuses);
    const operatorsJSON = JSON.stringify(validatedData.operators);

    // Use INSERT OR REPLACE instead of separate INSERT/UPDATE logic
    const query = `
      INSERT OR REPLACE INTO shop_settings (
        id,
        hours_per_day,
        operating_days,
        operating_hours,
        machines,
        machine_types,
        statuses,
        operators,
        created_at,
        updated_at
      ) VALUES (
        (SELECT id FROM shop_settings LIMIT 1),
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        COALESCE((SELECT created_at FROM shop_settings LIMIT 1), CURRENT_TIMESTAMP),
        CURRENT_TIMESTAMP
      )`;

    db.run(
      query,
      [
        validatedData.hoursPerDay,
        operatingDaysJSON,
        operatingHoursJSON,
        machinesJSON,
        machineTypesJSON,
        statusesJSON,
        operatorsJSON
      ],
      function(err) {
        if (err) {
          console.error('Error updating shop settings:', err);
          return res.status(500).json({ error: 'Failed to update shop settings', details: err.message });
        }

        // Log success and return updated data
        console.log('Shop settings updated successfully');
        res.status(200).json({
          message: 'Shop settings updated successfully',
          data: validatedData
        });
      }
    );
  } catch (error) {
    console.error('Error processing shop settings POST request:', error);
    res.status(500).json({ error: 'Server error processing shop settings', details: error.message });
  }
});

// Parts API Endpoints
app.get('/api/parts', (req, res) => {
  db.all('SELECT * FROM parts ORDER BY part_number ASC', (err, rows) => {
    if (err) {
      console.error('Error fetching parts:', err);
      return res.status(500).json({ error: 'Database error while fetching parts' });
    }
    
    // Transform database column names to camelCase and convert cycle time to minutes
    const parts = rows.map(row => ({
      id: row.id,
      partNumber: row.part_number,
      revision: row.revision,
      description: row.description,
      materialType: row.material_type,
      materialSpec: row.material_spec,
      cycleTime: row.cycle_time * 60, // Convert hours to minutes
      setup: row.setup_time, // Keep setup time in hours
      machine: row.machine,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.status(200).json(parts);
  });
});

app.post('/api/parts', (req, res) => {
  try {
    const { 
      partNumber, revision, description, materialType, 
      materialSpec, cycleTime, setup, machine, notes 
    } = req.body;
    
    // Validate required fields
    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }
    
    // Convert cycle time from minutes to hours for storage
    const cycleTimeHours = cycleTime ? (cycleTime / 60) : 0;
    
    // Insert new part
    const query = `
      INSERT INTO parts (
        part_number, revision, description, material_type, 
        material_spec, cycle_time, setup_time, machine, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(
      query, 
      [partNumber, revision, description, materialType, 
       materialSpec, cycleTimeHours, setup || 0, machine, notes],
      function(err) {
        if (err) {
          console.error('Error creating part:', err);
          return res.status(500).json({ error: 'Failed to create part' });
        }
        
        const id = this.lastID;
        
        // Return the created part
        db.get('SELECT * FROM parts WHERE id = ?', [id], (err, row) => {
          if (err) {
            console.error('Error fetching created part:', err);
            return res.status(201).json({ 
              message: 'Part created successfully, but unable to retrieve it',
              id
            });
          }
          
          // Transform to camelCase and convert cycle time to minutes
          const part = {
            id: row.id,
            partNumber: row.part_number,
            revision: row.revision,
            description: row.description,
            materialType: row.material_type,
            materialSpec: row.material_spec,
            cycleTime: row.cycle_time * 60, // Convert hours to minutes
            setup: row.setup_time, // Keep setup time in hours
            machine: row.machine,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
          
          res.status(201).json(part);
        });
      }
    );
  } catch (error) {
    console.error('Error creating part:', error);
    res.status(500).json({ error: 'Failed to create part', details: error.message });
  }
});

// Direct check for part by part number and revision (for debugging)
app.get('/api/parts/check/:partNumber/:revision?', (req, res) => {
  const { partNumber } = req.params;
  const revision = req.params.revision || null;
  
  console.log(`DIRECT CHECK: Looking for part_number="${partNumber}", revision="${revision}"`);
  
  // Log all parts for debugging
  db.all('SELECT part_number, revision FROM parts', [], (allErr, allRows) => {
    if (allErr) {
      console.error('Error listing all parts:', allErr);
    } else {
      console.log('All parts in database:', JSON.stringify(allRows));
    }
    
    // Now do the specific lookup
    let query = 'SELECT * FROM parts WHERE LOWER(TRIM(part_number)) = LOWER(TRIM(?))';
    let params = [partNumber];
    
    if (revision) {
      query += ' AND LOWER(TRIM(revision)) = LOWER(TRIM(?))';
      params.push(revision);
    } else {
      query += ' AND (revision IS NULL OR revision = "")';
    }
    
    console.log('Executing SQL:', query, 'with params:', params);
    
    db.get(query, params, (err, row) => {
      if (err) {
        console.error('Error in direct part check:', err);
        return res.status(500).json({ error: 'Database error during part check', details: err.message });
      }
      
      if (!row) {
        // If not found with exact match, try more permissive match
        console.log('Not found with exact match, trying permissive match');
        let permissiveQuery = 'SELECT * FROM parts WHERE LOWER(TRIM(part_number)) = LOWER(TRIM(?))';
        
        db.get(permissiveQuery, [partNumber], (permErr, permRow) => {
          if (permErr) {
            console.error('Error in permissive part check:', permErr);
            return res.status(500).json({ error: 'Database error during permissive part check' });
          }
          
          if (!permRow) {
            return res.status(200).json({ found: false });
          }
          
          // Transform to camelCase and convert cycle time to minutes
          const part = {
            id: permRow.id,
            partNumber: permRow.part_number,
            revision: permRow.revision,
            description: permRow.description,
            materialType: permRow.material_type,
            materialSpec: permRow.material_spec,
            cycleTime: permRow.cycle_time * 60, // Convert hours to minutes
            setup: permRow.setup_time, // Keep setup time in hours
            machine: permRow.machine,
            notes: permRow.notes,
            createdAt: permRow.created_at,
            updatedAt: permRow.updated_at
          };
          
          res.status(200).json({ found: true, part, note: 'Found with permissive match' });
        });
        return;
      }
      
      // Transform to camelCase and convert cycle time to minutes
      const part = {
        id: row.id,
        partNumber: row.part_number,
        revision: row.revision,
        description: row.description,
        materialType: row.material_type,
        materialSpec: row.material_spec,
        cycleTime: row.cycle_time * 60, // Convert hours to minutes
        setup: row.setup_time, // Keep setup time in hours
        machine: row.machine,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      
      res.status(200).json({ found: true, part });
    });
  });
});

// Get a specific part
app.get('/api/parts/:id', (req, res, next) => {
  const { id } = req.params;
  
  // Skip if we're requesting the check endpoint
  if (id === 'check') {
    return next();
  }
  
  db.get('SELECT * FROM parts WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error fetching part:', err);
      return res.status(500).json({ error: 'Database error while fetching part' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    // Transform to camelCase and convert cycle time to minutes
    const part = {
      id: row.id,
      partNumber: row.part_number,
      revision: row.revision,
      description: row.description,
      materialType: row.material_type,
      materialSpec: row.material_spec,
      cycleTime: row.cycle_time * 60, // Convert hours to minutes
      setup: row.setup_time, // Keep setup time in hours
      machine: row.machine,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    res.status(200).json(part);
  });
});

app.put('/api/parts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { 
      partNumber, revision, description, materialType, 
      materialSpec, cycleTime, setup, machine, notes 
    } = req.body;
    
    // Validate required fields
    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }
    
    // Convert cycle time from minutes to hours for storage
    const cycleTimeHours = cycleTime ? (cycleTime / 60) : 0;
    
    // Update part
    const query = `
      UPDATE parts SET
        part_number = ?,
        revision = ?,
        description = ?,
        material_type = ?,
        material_spec = ?,
        cycle_time = ?,
        setup_time = ?,
        machine = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(
      query, 
      [partNumber, revision, description, materialType, 
       materialSpec, cycleTimeHours, setup || 0, machine, notes, id],
      function(err) {
        if (err) {
          console.error('Error updating part:', err);
          return res.status(500).json({ error: 'Failed to update part' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Part not found' });
        }
        
        // Return the updated part
        db.get('SELECT * FROM parts WHERE id = ?', [id], (err, row) => {
          if (err) {
            console.error('Error fetching updated part:', err);
            return res.status(200).json({ 
              message: 'Part updated successfully, but unable to retrieve it',
              id
            });
          }
          
          // Transform to camelCase and convert cycle time to minutes
          const part = {
            id: row.id,
            partNumber: row.part_number,
            revision: row.revision,
            description: row.description,
            materialType: row.material_type,
            materialSpec: row.material_spec,
            cycleTime: row.cycle_time * 60, // Convert hours to minutes
            setup: row.setup_time, // Keep setup time in hours
            machine: row.machine,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
          
          res.status(200).json(part);
        });
      }
    );
  } catch (error) {
    console.error('Error updating part:', error);
    res.status(500).json({ error: 'Failed to update part', details: error.message });
  }
});

app.delete('/api/parts/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM parts WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting part:', err);
      return res.status(500).json({ error: 'Failed to delete part' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Part not found' });
    }
    
    res.status(200).json({ message: 'Part deleted successfully' });
  });
});

// Add a function to calculate the real job duration based on setup time and cycle time
const calculateJobDuration = (job) => {
  // Get setup time and cycle time from job
  const setupTimeHours = job.setup_time ? parseFloat(job.setup_time) : 0;
  const cycleTimeHoursPerPart = job.cycle_time ? parseFloat(job.cycle_time) : 0;
  const quantity = job.quantity || 1;
  
  // Calculate total cycle time for all parts (cycle time per part * quantity)
  const totalCycleTimeHours = cycleTimeHoursPerPart * quantity;
  
  // Total time is setup time plus cycle time for all parts
  const totalTimeHours = setupTimeHours + totalCycleTimeHours;
  
  // If we have valid setup and cycle time data, use it
  if (setupTimeHours > 0 || cycleTimeHoursPerPart > 0) {
    return {
      setupTime: setupTimeHours,
      cycleTime: totalCycleTimeHours,
      totalTime: totalTimeHours
    };
  }
  
  // Fallback to estimate based on quantity if no times are specified
  const estimatedDays = Math.max(1, Math.ceil(quantity / 10));
  return {
    setupTime: 1, // Default setup time of 1 hour
    cycleTime: (estimatedDays * 8) - 1, // Rest of the time is cycle time
    totalTime: estimatedDays * 8 // Total time in hours
  };
};

// Handle job report submissions
app.post('/api/job-reports', (req, res) => {
  const { po_id, actual_hours, parts_completed, quality_issues, notes } = req.body;

  if (!po_id || !actual_hours || !parts_completed) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'INSERT INTO job_reports (po_id, actual_hours, parts_completed, quality_issues, notes) VALUES (?, ?, ?, ?, ?)',
    [po_id, actual_hours, parts_completed, quality_issues || null, notes || null],
    function(err) {
      if (err) {
        console.error('Error saving job report:', err);
        return res.status(500).json({ error: 'Failed to save job report' });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 