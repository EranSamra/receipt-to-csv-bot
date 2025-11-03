// Simple base64 encoding function
function encodeBase64(buffer) {
  return Buffer.from(buffer, 'binary').toString('base64');
}

export default async function handler(req, res) {
  // Enable CORS for mobile browsers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Mobile debugging logs
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const origin = req.headers['origin'] || 'Unknown';
    console.log('📱 Processing receipt extraction request...');
    console.log('🌐 Origin:', origin);
    console.log('📱 User Agent:', userAgent);
    console.log('📦 Content-Type:', req.headers['content-type']);
    console.log('📏 Content-Length:', req.headers['content-length']);
    
    // Check if we have the Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Parse multipart form data manually for Vercel
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'No multipart boundary found' });
    }

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      req.on('end', resolve);
      req.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    
    console.log(`📦 Received ${chunks.length} chunks, total size: ${buffer.length} bytes`);
    console.log(`📱 Detected as: ${isMobile ? 'Mobile' : 'Desktop'} device`);
    
    // Debug: Log first 500 bytes to see format (mobile browsers may differ)
    if (buffer.length > 0) {
      const preview = buffer.slice(0, Math.min(500, buffer.length)).toString('utf8', 0, Math.min(500, buffer.length));
      console.log('📋 Buffer preview (first 500 bytes):', preview.substring(0, 200) + '...');
      
      // Check for mobile-specific markers
      if (preview.includes('\n\n') && !preview.includes('\r\n\r\n')) {
        console.warn('⚠️ Mobile browser detected: Uses \\n\\n instead of \\r\\n\\r\\n');
      }
    }
    
    const files = parseMultipartData(buffer, boundary);
    console.log(`📁 Parsed ${files.length} file(s) from multipart data`);
    
    // Log each parsed file for debugging
    files.forEach((file, index) => {
      console.log(`📄 File ${index + 1}:`, {
        filename: file.filename,
        mimetype: file.mimetype,
        size: `${(file.data.length / 1024).toFixed(2)} KB`,
        hasData: file.data.length > 0
      });
    });
    
    if (!files || files.length === 0) {
      console.error('❌ No files parsed from multipart data');
      console.error('Debug Info:', {
        boundary,
        bufferLength: buffer.length,
        chunksCount: chunks.length,
        userAgent,
        isMobile,
        contentType: req.headers['content-type']
      });
      return res.status(400).json({ 
        error: 'No files provided. Please ensure your files are valid images or PDFs.',
        debug: isMobile ? {
          suggestion: 'If using iOS, try converting HEIC files to JPEG first',
          detectedDevice: 'Mobile'
        } : {}
      });
    }

    console.log(`Processing ${files.length} file(s)`);

    // Process files one at a time to avoid memory issues
    const results = [];
    
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.filename}, size: ${file.data.length} bytes`);
        
        // Check file size limit (1MB max)
        if (file.data.length > 1024 * 1024) {
          console.error(`File ${file.filename} is too large: ${file.data.length} bytes`);
          results.push({
            filename: file.filename,
            error: 'File too large. Maximum size is 1MB.'
          });
          continue;
        }
        
        // Convert to base64
        const base64 = encodeBase64(file.data);
        console.log(`Successfully encoded ${file.filename}`);
        
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
            filename: file.filename,
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
                  filename: file.filename,
                  csv: updatedRow.trim()
                });
              } else {
                results.push({
                  filename: file.filename,
                  csv: row.trim()
                });
              }
            }
          });
        } else if (lines.length === 1 && !lines[0].includes('Invoice Number')) {
          // Single line that's not a header
          results.push({
            filename: file.filename,
            csv: lines[0].trim()
          });
        }
        
        console.log(`Successfully processed ${file.filename}`);
        
      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error);
        
        // Safe error message extraction
        let errorMsg = 'Unknown error occurred';
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (error && typeof error === 'object' && error.message) {
          errorMsg = String(error.message);
        } else if (error !== null && error !== undefined) {
          errorMsg = String(error);
        }
        
        results.push({
          filename: file.filename,
          error: `Processing error: ${errorMsg}`
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
    
    // Safe error message extraction
    let errorMsg = 'Internal server error';
    if (error instanceof Error) {
      errorMsg = error.message;
    } else if (error && typeof error === 'object' && error.message) {
      errorMsg = String(error.message);
    } else if (error !== null && error !== undefined) {
      errorMsg = String(error);
    }
    
    res.status(500).json({ 
      error: errorMsg,
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
}

// Parse multipart form data manually
function parseMultipartData(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;
  
  while (true) {
    const boundaryIndex = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIndex === -1) break;
    
    if (start > 0) {
      const partBuffer = buffer.slice(start, boundaryIndex);
      const file = parsePart(partBuffer);
      if (file) parts.push(file);
    }
    
    start = boundaryIndex + boundaryBuffer.length;
  }
  
  return parts;
}

function parsePart(buffer) {
  // Try both \r\n\r\n and \n\n (mobile browsers may use different line endings)
  let headerEnd = buffer.indexOf('\r\n\r\n');
  let headerEndOffset = 4;
  if (headerEnd === -1) {
    headerEnd = buffer.indexOf('\n\n');
    headerEndOffset = 2;
  }
  if (headerEnd === -1) {
    console.warn('⚠️ Could not find header end in multipart data');
    return null;
  }
  
  const headers = buffer.slice(0, headerEnd).toString();
  const data = buffer.slice(headerEnd + headerEndOffset);
  
  // More flexible filename matching (handle mobile browser differences)
  const filenameMatch = headers.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n;]+)/i);
  
  let filename = null;
  if (filenameMatch) {
    // Extract filename from the match
    let matchedFilename = filenameMatch[1];
    // Remove quotes if present
    if ((matchedFilename.startsWith('"') && matchedFilename.endsWith('"')) ||
        (matchedFilename.startsWith("'") && matchedFilename.endsWith("'"))) {
      matchedFilename = matchedFilename.slice(1, -1);
    }
    filename = matchedFilename.trim();
  }
  
  if (!filename || filename === '') {
    console.warn('⚠️ Could not extract filename from multipart data');
    return null;
  }
  
  // Better MIME type detection for mobile
  let mimetype = 'application/octet-stream';
  if (contentTypeMatch) {
    mimetype = contentTypeMatch[1].trim();
  } else {
    // Fallback: Detect MIME type from filename
    const lowerFilename = filename.toLowerCase();
    if (/\.(jpg|jpeg)$/i.test(lowerFilename)) {
      mimetype = 'image/jpeg';
    } else if (/\.png$/i.test(lowerFilename)) {
      mimetype = 'image/png';
    } else if (/\.(heic|heif)$/i.test(lowerFilename)) {
      mimetype = 'image/heic'; // Some mobile browsers use this
    } else if (/\.webp$/i.test(lowerFilename)) {
      mimetype = 'image/webp';
    } else if (/\.pdf$/i.test(lowerFilename)) {
      mimetype = 'application/pdf';
    } else if (/\.(gif)$/i.test(lowerFilename)) {
      mimetype = 'image/gif';
    }
  }
  
  console.log(`📄 Parsed file: ${filename}, type: ${mimetype}, size: ${data.length} bytes`);
  
  return {
    filename: filename,
    mimetype: mimetype,
    data: data
  };
}

// Configure the API route to handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};