const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 30 // Allow up to 30 files
  }
});

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY';

// Simple base64 encoding function
function encodeBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

// Receipt extraction endpoint
app.post('/api/extract-receipts', (req, res, next) => {
  upload.array('files', 30)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('Processing receipt extraction request...');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const files = req.files;
    console.log(`Processing ${files.length} file(s)`);

    // Process files in batches to handle rate limits and large volumes
    const results = [];
    const BATCH_SIZE = 5; // Process 5 files at a time
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(files.length/BATCH_SIZE)} (${batch.length} files)`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (file) => {
        try {
          console.log(`Processing file: ${file.originalname}, size: ${file.size} bytes`);
          
          // Check file size limit (1MB max)
          if (file.size > 1024 * 1024) {
            console.error(`File ${file.originalname} is too large: ${file.size} bytes`);
            return {
              filename: file.originalname,
              error: 'File too large. Maximum size is 1MB.'
            };
          }
          
          // Convert to base64
          const base64 = encodeBase64(file.buffer);
          console.log(`Successfully encoded ${file.originalname}`);
          
          // Call Gemini API
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { 
                    text: `You are a deterministic receipt data extractor. Return only a CSV that matches the exact schema and column order below. Do not include explanations, code fences, JSON, or any extra text. Output the CSV only.

Schema

CSV header and order must be exactly:
Invoice Number,Date,Amount,Currency,Merchant,Transaction Type

Field definitions

Invoice Number: Receipt number, invoice ID, transaction reference, or order number. If multiple items appear on the same receipt/invoice, use the SAME invoice number for ALL items from that receipt. If multiple rows have the same invoice number, use the same invoice number for all related rows. Leave blank if not found.

Date: Transaction date in YYYY-MM-DD. If only month and year are present, use the first day of that month. If both order and payment dates appear, use the payment date. Leave blank if unknown.

Amount: Final amount paid as a positive decimal with a period for decimals. Include tax and tip if they are part of the final total. If the document indicates a refund or return, make the amount negative.

Currency: ISO 4217 code in uppercase. If the receipt shows a symbol, map it to the likely ISO code. If multiple currencies appear, choose the currency of the charged total. Leave blank if unknown.

Merchant: Merchant or brand name, normalized by removing legal suffixes (Inc, LLC, Ltd, GmbH). Keep the primary brand name.

Transaction Type: One of only these values: Card, Cash, Wire, Transfer, Invoice, Refund, Credit, Debit, Other.

Map examples:

Visa, Mastercard, Amex, credit card, POS card slip -> Card

Cash, paid in cash -> Cash

Bank transfer, ACH, SEPA, wire -> Wire

Internal account transfer -> Transfer

Invoice to be paid or invoice paid later -> Invoice

Refund receipt or return processed -> Refund

Store credit issued -> Credit

Debit card -> Debit

Unclear -> Other

Extraction rules

One row per distinct receipt or transaction. If a file contains multiple receipts, output one row per receipt. If a single receipt contains multiple items, create one row per item but use the SAME invoice number for all items from that receipt.

Prefer "Total" or "Amount paid" for Amount. If a final total exists, do not recompute from subtotal and tax.

Strip currency symbols and thousand separators in Amount. Keep two decimal places when present.

Normalize dates to YYYY-MM-DD.

If authorization and settlement differ, use the settled amount.

If multiple currencies appear with a conversion, choose the currency actually charged.

If payment instrument is unclear but a card brand or last 4 digits appear, set Transaction Type to Card.

If the file is a quote, pro forma, or only a shopping cart with no payment, do not output a row.

If a field is truly missing, leave the cell empty. Do not invent values.

Do not add or remove columns. Do not reorder columns. Include the header exactly once.

Output format

Return only the CSV.

Use commas as separators. No trailing commas.

Do not wrap values in quotes unless a field contains a comma. Dates and amounts should not be quoted.

Example for multiple items on same receipt:
If a receipt shows:
- Invoice #12345, Coffee $5.00, Sandwich $8.50, Total $13.50

Output should be:
Invoice Number,Date,Amount,Currency,Merchant,Transaction Type
12345,2024-01-15,5.00,USD,Coffee Shop,Card
12345,2024-01-15,8.50,USD,Coffee Shop,Card` 
                  },
                  { inline_data: { mime_type: file.mimetype, data: base64 } }
                ]
              }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
              }
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error:', response.status, errorText);
            return {
              filename: file.originalname,
              error: 'Failed to process with AI'
            };
          }

          const data = await response.json();
          const csvContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          // Parse CSV content - new schema: Invoice Number,Date,Amount,Currency,Merchant,Transaction Type
          const lines = csvContent.trim().split('\n');
          
          // If we have multiple lines, process each data row (skip header)
          if (lines.length > 1) {
            const dataRows = lines.slice(1); // Skip header
            const fileResults = [];
            dataRows.forEach(row => {
              if (row.trim()) { // Only process non-empty rows
                fileResults.push({
                  filename: file.originalname,
                  csv: row.trim()
                });
              }
            });
            return fileResults;
          } else if (lines.length === 1 && !lines[0].includes('Invoice Number')) {
            // Single line that's not a header
            return {
              filename: file.originalname,
              csv: lines[0].trim()
            };
          }
          
          console.log(`Successfully processed ${file.originalname}`);
          return null; // No data extracted
          
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          return {
            filename: file.originalname,
            error: error.message
          };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten results (some files might return multiple rows)
      batchResults.forEach(result => {
        if (Array.isArray(result)) {
          results.push(...result);
        } else if (result) {
          results.push(result);
        }
      });
      
      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < files.length) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // Combine all results into a single CSV with new schema
    const csvHeader = "Invoice Number,Date,Amount,Currency,Merchant,Transaction Type";
    const csvRows = results.map(r => r.csv || '');
    const finalCsv = [csvHeader, ...csvRows].join('\n');

    console.log('Extraction completed successfully');
    res.json({ csv: finalCsv });

  } catch (error) {
    console.error('Error in extract-receipts endpoint:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Receipt scanner server is running',
    geminiApiKey: GEMINI_API_KEY ? 'Configured' : 'Not configured'
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Receipt Scanner Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Gemini API Key: ${GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
});
