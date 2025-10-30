const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
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

    // Process files one at a time to avoid memory issues
    const results = [];
    
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.originalname}, size: ${file.size} bytes`);
        
        // Check file size limit (1MB max)
        if (file.size > 1024 * 1024) {
          console.error(`File ${file.originalname} is too large: ${file.size} bytes`);
          results.push({
            filename: file.originalname,
            error: 'File too large. Maximum size is 1MB.'
          });
          continue;
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

Invoice Number: Receipt number, invoice ID, transaction reference, or order number EXTRACTED FROM THE DOCUMENT. NEVER invent or generate invoice numbers. If no invoice number is visible in the document, leave this field completely empty. If multiple rows have the same invoice number, use the same invoice number for all related rows.

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

One row per distinct receipt or transaction. If a file contains multiple receipts, output one row per receipt.

DUPLICATE DETECTION: If the same receipt appears multiple times in the uploaded files (same merchant, same date, same amount), add "DUPLICATE RECEIPT UPLOADED" to the Merchant field for the duplicate entries. This helps identify when users accidentally upload the same receipt twice.

Prefer "Total" or "Amount paid" for Amount. If a final total exists, do not recompute from subtotal and tax.

Strip currency symbols and thousand separators in Amount. Keep two decimal places when present.

Normalize dates to YYYY-MM-DD.

If authorization and settlement differ, use the settled amount.

If multiple currencies appear with a conversion, choose the currency actually charged.

If payment instrument is unclear but a card brand or last 4 digits appear, set Transaction Type to Card.

If the file is a quote, pro forma, or only a shopping cart with no payment, do not output a row.

If a field is truly missing, leave the cell empty. Do not invent values. This is especially important for Invoice Number - only extract what is actually visible in the document. Never generate or create invoice numbers.

Do not add or remove columns. Do not reorder columns. Include the header exactly once.

Output format

Return only the CSV.

Use commas as separators. No trailing commas.

Do not wrap values in quotes unless a field contains a comma. Dates and amounts should not be quoted.` 
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
          results.push({
            filename: file.originalname,
            error: 'Failed to process with AI'
          });
          continue;
        }

        const data = await response.json();
        const csvContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Parse CSV content - new schema: Invoice Number,Date,Amount,Currency,Merchant,Transaction Type
        const lines = csvContent.trim().split('\n');
        
        // If we have multiple lines, process each data row (skip header)
        if (lines.length > 1) {
          const dataRows = lines.slice(1); // Skip header
          let sharedInvoiceNumber = null;
          
          dataRows.forEach((row, index) => {
            if (row.trim()) { // Only process non-empty rows
              const columns = row.split(',');
              
              // For the first row, extract the invoice number to share with subsequent rows
              if (index === 0 && columns.length >= 1) {
                sharedInvoiceNumber = columns[0].trim();
              }
              
              // If this row doesn't have an invoice number but we have a shared one, use it
              if ((!columns[0] || columns[0].trim() === '') && sharedInvoiceNumber) {
                columns[0] = sharedInvoiceNumber;
                const updatedRow = columns.join(',');
                results.push({
                  filename: file.originalname,
                  csv: updatedRow.trim()
                });
              } else {
                results.push({
                  filename: file.originalname,
                  csv: row.trim()
                });
              }
            }
          });
        } else if (lines.length === 1 && !lines[0].includes('Invoice Number')) {
          // Single line that's not a header
          results.push({
            filename: file.originalname,
            csv: lines[0].trim()
          });
        }
        
        console.log(`Successfully processed ${file.originalname}`);
        
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        results.push({
          filename: file.originalname,
          error: error.message
        });
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Receipt Data Extractor API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Receipt Scanner Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Gemini API Key: ${GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
});
