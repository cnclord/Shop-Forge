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
  // Create purchase_orders table with new pdf_path field and machine field
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL,
      customer TEXT,
      part_number TEXT,
      revision TEXT,
      date TEXT,
      due_date TEXT,
      total_amount REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pdf_path TEXT,
      machine TEXT
    )
  `);
  
  // Create po_items table with new revision field
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
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error initializing database:', err);
    } else {
      console.log('Database tables initialized');
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
          'INSERT INTO purchase_orders (po_number, customer, due_date, part_number, revision, pdf_path, machine) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [poNumber, customer, dueDate, part_number, revision, pdf_path, machine],
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
          'UPDATE purchase_orders SET po_number = ?, customer = ?, due_date = ?, part_number = ?, revision = ?, machine = ? WHERE id = ?',
          [poNumber, customer, dueDate, part_number, revision, machine, poId],
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

// Get all purchase orders
app.get('/api/purchase-orders', (req, res) => {
  db.all(
    'SELECT * FROM purchase_orders ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        console.error('Error fetching purchase orders:', err);
        return res.status(500).json({ error: 'Failed to fetch purchase orders' });
      }
      res.status(200).json(rows);
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
  const { po_number, customer, part_number, revision, due_date, status, machine } = req.body;
  
  db.run(
    'UPDATE purchase_orders SET po_number = ?, customer = ?, part_number = ?, revision = ?, due_date = ?, status = ?, machine = ? WHERE id = ?',
    [po_number, customer, part_number || null, revision || null, due_date, status, machine || null, id],
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

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 