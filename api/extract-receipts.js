const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 30 // Allow up to 30 files
  }
});

// Simple base64 encoding function
function encodeBase64(buffer) {
  return Buffer.from(buffer, 'binary').toString('base64');
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Processing receipt extraction request...');
    
    // Handle file upload with multer
    await new Promise((resolve, reject) => {
      upload.array('files', 30)(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          return reject(new Error('File upload error: ' + err.message));
        }
        resolve();
      });
    });

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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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

Invoice Number: Receipt number, invoice ID, transaction reference, or order number. If multiple rows have the same invoice number, use the same invoice number for all related rows. Leave blank if not found.

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
    res.status(200).json({ csv: finalCsv });
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Configure the API route to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};
