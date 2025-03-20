const pdfParse = require('pdf-parse');

/**
 * Parse a PO PDF file and extract relevant information
 * 
 * @param {Buffer} pdfBuffer - The PDF file as a buffer
 * @returns {Object} The extracted PO data
 */
async function parsePOPdf(pdfBuffer) {
  try {
    // Log buffer size for debugging
    console.log('PDF buffer size:', pdfBuffer.length);
    
    const data = await pdfParse(pdfBuffer);
    const text = data.text;
    
    // Log the raw text for debugging
    console.log('PDF text length:', text.length);
    console.log('PDF first 500 chars:', text.substring(0, 500));
    
    // =================================================================
    // EXTRACT PO NUMBER - Thorlabs format typically T1053915 or T1053915-1
    // =================================================================
    const poNumberPatterns = [
      /Purchase\s+Order\s+(T\d+(?:-\d+)?)/i,           // "Purchase Order T1053915"
      /PO\s+Number\s*:*\s*(T\d+(?:-\d+)?)/i,           // "PO Number: T1053915"
      /PO\s*#*\s*:*\s*(T\d+(?:-\d+)?)/i,               // "PO #: T1053915" 
      /\n(T\d+(?:-\d+)?)\n/,                           // T1053915 on its own line
      /^(T\d+(?:-\d+)?)$/m                             // T1053915 as a complete line
    ];
    
    let poNumber = extractWithPatterns(text, poNumberPatterns);
    if (!poNumber) {
      // Fallback to a more general pattern but be more careful with validation
      const generalMatch = text.match(/(T\d+(?:-\d+)?)/);
      if (generalMatch && generalMatch[1] && /^T\d+(?:-\d+)?$/.test(generalMatch[1])) {
        poNumber = generalMatch[1];
      }
    }
    
    // =================================================================
    // EXTRACT CUSTOMER - Typically "Thorlabs Inc" in various forms
    // =================================================================
    const customerPatterns = [
      /Thorlabs\s+Inc(?:\.|,|\n|$)/i,                 // "Thorlabs Inc" with various endings
      /THORLABS\s+INC(?:\.|,|\n|$)/i,                 // "THORLABS INC" uppercase
      /Vendor\s*:*\s*Thorlabs/i,                      // "Vendor: Thorlabs"
      /Bill\s+To\s*:*\s*Thorlabs/i,                   // "Bill To: Thorlabs"
      /^Thorlabs\s+Inc\s*$/mi                         // "Thorlabs Inc" on its own line
    ];
    
    let customer = extractWithPatterns(text, customerPatterns);
    if (!customer) {
      // Look for any mention of Thorlabs in the text
      if (text.includes('Thorlabs') || text.includes('THORLABS')) {
        customer = 'Thorlabs Inc';
      } else {
        customer = 'Unknown';
      }
    }
    
    // =================================================================
    // EXTRACT PART NUMBER - Thorlabs format like FT-MMAC-1-ENGRAVE
    // =================================================================
    const partNumberPatterns = [
      /Item#\s*\/\s*Description[\s\S]*?\n([A-Z]+-[A-Z]+-\d+-[A-Z]+)/i,  // After Item#/Description header
      /Item#[\s\S]*?\n([A-Z]+-[A-Z]+-\d+-[A-Z]+)/i,                   // After Item# header
      /Item\s*#*:*\s*([A-Z]+-[A-Z]+-\d+-[A-Z]+)/i,                    // "Item#: FT-MMAC-1-ENGRAVE"
      /\n([A-Z]+-[A-Z]+-\d+-[A-Z]+)\n/,                               // Part number on its own line
      /\n(FT-[A-Z]+-\d+-[A-Z]+)/,                                     // FT- specific pattern at start of line
      /\n(FPC\d+-\d+-[A-Z]+)/,                                        // FPC specific pattern at start of line
      /\n(BFT-[A-Z]+-\d+-[A-Z]+)/                                     // BFT specific pattern at start of line
    ];
    
    let partNumber = extractWithPatterns(text, partNumberPatterns);
    
    // =================================================================
    // EXTRACT REVISION - Usually a single letter like "B" after "Rev"
    // =================================================================
    const revisionPatterns = [
      /Rev\.\s+([A-Z])\s/i,                           // "Rev. B " with space after
      /Rev\s+([A-Z])(?:\s|$)/i,                       // "Rev B" with space or end of line
      /Revision\s*:*\s*([A-Z])/i,                     // "Revision: B"
      /\s+Rev\s+([A-Z])(?:\s|$)/i,                    // " Rev B" with space before
      /\s+([A-Z])\s+Rev\b/i,                          // " B Rev" - reverse order
      /Support.*\s+Rev\s+([A-Z])/i                    // "Support bracket xxxxx Rev C"
    ];
    
    let revision = extractWithPatterns(text, revisionPatterns);
    // Ensure revision is just a single letter
    if (revision && revision.length > 1) {
      const singleChar = revision.match(/^([A-Z])$/i);
      revision = singleChar ? singleChar[1] : revision.charAt(0);
    }
    
    // =================================================================
    // EXTRACT DUE DATE - Usually in MM/DD/YYYY format
    // =================================================================
    const dueDatePatterns = [
      /Arrival\s+Date.*?(\d{1,2}\/\d{1,2}\/\d{4})/i,                // "Arrival Date...03/28/2024"
      /Due\s+Date\s*:*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,               // "Due Date: 03/28/2024"
      /Delivery\s+Date\s*:*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,          // "Delivery Date: 03/28/2024"
      /(\d{1,2}\/\d{1,2}\/\d{4})(?=\s*pcs)/i,                       // "03/28/2024pcs"
      /(\d{1,2}\/\d{1,2}\/\d{4})\s*$/m                              // Date at end of line
    ];
    
    let dueDate = extractWithPatterns(text, dueDatePatterns);
    
    // =================================================================
    // EXTRACT ORDER DATE - Usually in MM/DD/YYYY format
    // =================================================================
    const datePatterns = [
      /PO\s+Created\s+Date\s*:*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,      // "PO Created Date: 01/25/2024"
      /Issue\s+Date\s*:*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,             // "Issue Date: 01/25/2024" 
      /Order\s+Date\s*:*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,             // "Order Date: 01/25/2024"
      /Date\s*:*\s*(\d{1,2}\/\d{1,2}\/\d{4})/i                      // "Date: 01/25/2024"
    ];
    
    let orderDate = extractWithPatterns(text, datePatterns);
    if (!orderDate) {
      // Fallback to any date in the document, but not the due date
      const anyDateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (anyDateMatch && anyDateMatch[1] && anyDateMatch[1] !== dueDate) {
        orderDate = anyDateMatch[1];
      }
    }
    
    // =================================================================
    // EXTRACT QUANTITY - Typically numeric value with potential decimals
    // =================================================================
    const quantityPatterns = [
      /Ordered\s+[\s\S]*?(\d+\.?\d*)\s+(?:EA|pcs)/i,               // "Ordered...25.00 EA/pcs"
      /Quantity\s*:*\s*(\d+\.?\d*)/i,                              // "Quantity: 25.00"
      /QTY\s*:*\s*(\d+\.?\d*)/i,                                   // "QTY: 25.00"
      /(\d+\.?\d*)\s*(?:EA|pcs)/i,                                 // "25.00 EA/pcs"
      /(\d+)\.00\d{2}\.001\.00/                                    // The format in some Thorlabs POs
    ];
    
    let quantity = extractWithPatterns(text, quantityPatterns);
    if (quantity) {
      quantity = parseFloat(quantity);
    } else {
      quantity = 0;
    }
    
    // Log all extracted data for debugging
    console.log('Extracted PO Number:', poNumber);
    console.log('Extracted Customer:', customer);
    console.log('Extracted Part Number:', partNumber);
    console.log('Extracted Revision:', revision);
    console.log('Extracted Due Date:', dueDate);
    console.log('Extracted Order Date:', orderDate);
    console.log('Extracted Quantity:', quantity);
    
    // Extract line items
    let lineItems = extractLineItems(text);
    
    // Try to find the total amount
    const totalAmountPatterns = [
      /Grand\s+Total\s+(\d+,?\d*\.\d{2})/i,                      // "Grand Total 5,850.00"
      /Total\s*:*\s*(\d+,?\d*\.\d{2})/i,                         // "Total: 5,850.00"
      /(\d+,\d+\.\d{2})\s*USD/,                                  // "5,850.00 USD"
      /(\d+,\d+\.\d{2})/                                         // Just "5,850.00"
    ];
    
    let totalAmount = 0;
    const totalStr = extractWithPatterns(text, totalAmountPatterns);
    
    if (totalStr) {
      totalAmount = parseFloat(totalStr.replace(/,/g, ''));
    } else if (lineItems.length > 0) {
      // Calculate from line items if available
      totalAmount = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    }
    
    // Format dates to YYYY-MM-DD if possible
    const formatDate = (dateStr) => {
      if (!dateStr) return null;
      
      const parts = dateStr.split(/[\/\-\.]/);
      
      // Handle different date formats
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        // For MM/DD/YYYY format
        return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
      return dateStr;
    };
    
    // Build the result object with more structured data
    const result = {
      poNumber: poNumber || 'Unknown',
      date: orderDate ? formatDate(orderDate) : null,
      dueDate: dueDate ? formatDate(dueDate) : null,
      customer: customer || 'Unknown',
      part_number: partNumber || null,
      revision: revision || null,
      quantity: quantity || 0,
      lineItems,
      totalAmount
    };
    
    console.log('Extracted data:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    console.error('Error parsing PDF:', error);
    // Return minimal structure with default values instead of throwing
    return {
      poNumber: 'Unknown',
      date: null,
      dueDate: null,
      customer: 'Unknown',
      part_number: null,
      revision: null,
      quantity: 0,
      lineItems: [],
      totalAmount: 0
    };
  }
}

/**
 * Helper function to extract text using multiple patterns
 * @param {string} text - The text to search in
 * @param {Array} patterns - Array of regex patterns to try
 * @returns {string|null} - The extracted text or null if not found
 */
function extractWithPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract line items using multiple strategies
 * @param {string} text - The PDF text
 * @returns {Array} Array of line items
 */
function extractLineItems(text) {
  const lineItems = [];
  let match;
  
  // Strategy 1: Thorlabs specific format with item details in specific structure
  const thorlabsRegex = /([A-Z]+-[A-Z]+-\d+-[A-Z]+)[\s\S]*?([^\n]+?)(?:Rev\s+([A-Z]))?[\s\S]*?(\d+\.?\d*)\s*(?:EA|pcs)[\s\S]*?(\d+,?\d*\.\d{2})/g;
  while ((match = thorlabsRegex.exec(text)) !== null) {
    try {
      const partNumber = match[1].trim();
      const description = match[2].trim();
      const revision = match[3] ? match[3].trim() : '';
      const quantity = parseFloat(match[4]) || 0;
      const lineTotal = parseFloat(match[5].replace(',', '')) || 0;
      
      lineItems.push({
        partNumber: partNumber,
        revision: revision,
        description: description,
        quantity: quantity,
        unitPrice: quantity > 0 ? lineTotal / quantity : 0,
        lineTotal: lineTotal
      });
    } catch (err) {
      console.error('Error parsing Thorlabs line item:', err);
    }
  }
  
  // Strategy 2: Look for the specific format in Thorlabs POs where line items are in a complex structure
  if (lineItems.length === 0) {
    const quantityPattern = /(\d+)\.00\d{2}\.001\.00(\d+,\d+\.\d{2})(\d{1,2}\/\d{1,2}\/\d{4})pcs/g;
    while ((match = quantityPattern.exec(text)) !== null) {
      try {
        // Find the part number before this pattern
        const prevText = text.substring(0, match.index);
        const lines = prevText.split('\n').reverse();
        let partNumber = null;
        let description = '';
        let revision = '';
        
        // Search backward for part number and description
        for (let i = 0; i < lines.length && i < 10; i++) {
          const partMatch = lines[i].match(/([A-Z]+-[A-Z]+-\d+-[A-Z]+)/);
        if (partMatch) {
          partNumber = partMatch[1];
            description = lines[i-1] || '';
            
            // Look for revision in surrounding lines
            for (let j = i-2; j <= i+2 && j < lines.length; j++) {
              if (j >= 0) {
                const revMatch = lines[j].match(/Rev\s+([A-Z])/i);
                if (revMatch) {
                  revision = revMatch[1];
                  break;
                }
              }
            }
            break;
          }
        }
        
        if (partNumber) {
          const quantity = parseInt(match[1], 10) || 0;
          const lineTotal = parseFloat(match[2].replace(',', '')) || 0;
        
        lineItems.push({
          partNumber: partNumber,
          revision: revision,
            description: description.trim(),
          quantity: quantity,
            unitPrice: quantity > 0 ? lineTotal / quantity : 0,
            lineTotal: lineTotal
        });
        }
      } catch (err) {
        console.error('Error parsing complex Thorlabs line item:', err);
      }
    }
  }
  
  // Strategy 3: General table format with rows
  if (lineItems.length === 0) {
    const tableRowRegex = /(\d+)\s+([A-Z0-9-]+(?:-[A-Z0-9]+)?)\s+([^\n]+?)\s+(\d+)\s+(\$*\d+\.\d{2})/g;
    
    while ((match = tableRowRegex.exec(text)) !== null) {
      try {
        // Extract part number and revision
        const partWithRev = match[2].trim();
        let partNumber = partWithRev;
        let revision = '';
        
        // Check if part number contains a revision
        const partMatch = partWithRev.match(/^(.+)-([A-Z0-9]+)$/);
        if (partMatch) {
          partNumber = partMatch[1];
          revision = partMatch[2];
        }
        
        const quantity = parseInt(match[4], 10) || 0;
        const unitPrice = parseFloat(match[5].replace('$', '')) || 0;
        
        lineItems.push({
          partNumber: partNumber,
          revision: revision,
          description: match[3].trim(),
          quantity: quantity,
          unitPrice: unitPrice,
          lineTotal: quantity * unitPrice
        });
      } catch (err) {
        console.error('Error parsing table row line item:', err);
      }
    }
  }
  
  // Strategy 4: Standard format with part number, description, quantity, unit price
  if (lineItems.length === 0) {
    const lineItemsRegex = /([A-Z0-9-]+(?:-[A-Z0-9]+)?)\s+([^\n]+?)\s+(\d+)\s+(\$*\d+\.\d{2})/g;
    while ((match = lineItemsRegex.exec(text)) !== null) {
      try {
        // Extract part number and revision
        const partWithRev = match[1].trim();
        let partNumber = partWithRev;
        let revision = '';
        
        // Check if part number contains a revision
        const partMatch = partWithRev.match(/^(.+)-([A-Z0-9]+)$/);
        if (partMatch) {
          partNumber = partMatch[1];
          revision = partMatch[2];
        }
        
        const quantity = parseInt(match[3], 10) || 0;
        const unitPrice = parseFloat(match[4].replace('$', '')) || 0;
        
        lineItems.push({
          partNumber: partNumber,
          revision: revision,
          description: match[2].trim(),
          quantity: quantity,
          unitPrice: unitPrice,
          lineTotal: quantity * unitPrice
        });
      } catch (err) {
        console.error('Error parsing standard line item:', err);
      }
    }
  }
  
  // Log extracted line items
  console.log(`Extracted ${lineItems.length} line items`);
  
  return lineItems;
}

module.exports = {
  parsePOPdf
}; 