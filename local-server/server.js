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
  return Buffer.from(buffer, 'binary').toString('base64');
}

// Helper function to convert JSON receipt to CSV row
function jsonToCSVRow(receipt) {
  // Map fraud risk from confidence - support both suspicious_fraude and suspicious_fraud_risk for backward compatibility
  let fraudRisk = 'Low';
  const fraudFlag = receipt.flags?.suspicious_fraude || receipt.flags?.suspicious_fraud_risk;
  if (fraudFlag && fraudFlag.value === true) {
    const conf = fraudFlag.confidence || 0;
    if (conf >= 0.75) fraudRisk = 'High';
    else if (conf >= 0.6) fraudRisk = 'Medium';
  }
  
  // Map duplicate flag
  const duplicate = (receipt.flags && receipt.flags.duplicate && receipt.flags.duplicate.value === true) ? 'Yes' : 'No';
  
  // Map alcohol/tobacco from unauthorized_category
  const alcoholTobacco = (receipt.flags && receipt.flags.unauthorized_category && receipt.flags.unauthorized_category.value === true && 
    receipt.flags.unauthorized_category.categories && 
    receipt.flags.unauthorized_category.categories.some(cat => 
      cat === 'Alcohol' || cat === 'Tobacco'
    )) ? 'Yes' : 'No';
  
  // Map personal expense
  const personalExpense = (receipt.flags && receipt.flags.suspicious_personal && receipt.flags.suspicious_personal.value === true) ? 
    'Suspicious Personal' : 'No';
  
  // Extract invoice number from receipt (extracted from document, not generated)
  const invoiceNumber = receipt.invoice_number || '';
  
  // Extract notes from receipt
  const notes = receipt.notes || '';
  
  return [
    invoiceNumber || '',
    receipt.date || '',
    receipt.amount !== undefined ? String(receipt.amount) : '',
    receipt.currency || '',
    receipt.merchant || '',
    receipt.transaction_type || 'Other',
    fraudRisk,
    duplicate,
    alcoholTobacco,
    personalExpense,
    notes
  ].join(',');
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
    console.log('📱 Processing receipt extraction request...');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const files = req.files;
    console.log(`Processing ${files.length} file(s)`);

    // Process files one at a time to avoid memory issues
    const results = [];
    
    for (const file of files) {
      try {
        const isPDF = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname);
        console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size} bytes, isPDF: ${isPDF}`);
        
        // Check file size limit (5MB max - PDFs can be larger)
        if (file.size > 5 * 1024 * 1024) {
          console.error(`File ${file.originalname} is too large: ${file.size} bytes`);
          results.push({
            filename: file.originalname,
            error: 'File too large. Maximum size is 5MB.'
          });
          continue;
        }
        
        // Convert to base64
        const base64 = encodeBase64(file.buffer);
        console.log(`Successfully encoded ${file.originalname} (${isPDF ? 'PDF' : 'Image'}), base64 length: ${base64.length} chars`);
        
        // Call Gemini API with new JSON-based prompt
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { 
                  text: `SYSTEM: You are a deterministic receipt extraction and classification engine for enterprise expense management. You must extract fields, classify receipts for fraud and policy violations, and return a single structured JSON object per receipt. Be conservative when deciding to flag. Provide evidence for every non-empty flag. Return JSON only. Do not include commentary or extra text.

OUTPUT SCHEMA:

Return a JSON array where each element is an object with exactly these keys:

receipt_id: string (unique id provided by caller or generated from file name and timestamp)
date: string (YYYY-MM-DD or empty)
amount: number (final paid amount, positive for charges, negative for refunds)
currency: string (ISO 4217 uppercase or empty)
merchant: string (normalized merchant name)
transaction_type: string (one of: Card, Cash, Wire, Transfer, Invoice, Refund, Credit, Debit, Other)

flags: object with keys:
  suspicious_fraude: { value: true|false, confidence: 0-1, evidence: [strings] }
  duplicate: { value: true|false, confidence: 0-1, evidence: [strings], duplicate_of: receipt_id|null }
  unauthorized_category: { value: true|false, confidence: 0-1, categories: [strings], evidence: [strings] } // categories: Alcohol, Tobacco, Gambling, Pharmaceuticals, Adult, Other
  suspicious_personal: { value: true|false, confidence: 0-1, evidence: [strings], vendor_match: [strings] } // vendor_match: list of matched personal-brand tokens

confidence_overall: number (0-1)
notes: string (short machine readable summary if needed)

PRIMARY EXTRACTION RULES:

Date: Use payment/settlement date if available. Normalize to YYYY-MM-DD. If only month-year, use first day of month.
Amount: Use final "Total" amount. Strip symbols and thousand separators. Keep decimal point. Negative for refunds.
Currency: Map symbol to ISO code when possible. Leave empty if unknown.
Merchant: Normalize by removing legal suffixes like Inc, Ltd, LLC, GmbH. Prefer brand name on top of receipt.

FLAGGING RULES:

suspicious_fraude: flag as true when one or more of the following conditions are met with supporting evidence:
- Visual/metadata anomalies: Image metadata missing or clearly generated (no camera EXIF), pixel patterns typical of image synthesis, OCR text inconsistent with typical receipt layouts, font mismatches, receipt image contains obvious artifacts of compositing
- Content anomalies: Order numbers/invoice numbers/tax IDs that do not match known formats, totals that do not match item sums, merchant name not found in business directories
- Behavioral anomalies: Extremely short upload-to-extract time with exact synthetic-like pixels
Evidence examples: "no-exif", "synthetic-font-pattern", "impossible-invoice-format", "mismatch-total-lines"
Require combined confidence >= 0.6 to mark as true.

duplicate: flag as true if any of:
- Exact image hash match (evidence: "image-hash-match")
- Perceptual hash near-match within threshold (evidence: "phash-similarity:X")
- OCR text similarity above threshold for merchant+date+amount (evidence: "ocr-similarity:XX%")
- Same merchant + same amount + same date within 1 day and near-identical payment instrument last4 (evidence: "merchant-amount-date-match")
Include duplicate_of with the matched receipt id.

unauthorized_category: flag as true for forbidden categories (Alcohol, Tobacco, Gambling, Pharmaceuticals, Adult, Other)
Use merchant name, line items, and OCR keywords to detect categories.
Keyword examples:
- Alcohol: wine, beer, liquor, bar, brew, vintner, cellar, vinos, vinoteca
- Tobacco: cigarette, cigar, tobacco, vape, vape shop
- Gambling: casino, sportsbook, bet, wager, slot, poker
- Adult: onlyfans, porn, xxx, camming
If multiple categories detected, list all.

suspicious_personal: flag as true when merchant or line items indicate clear personal spend
Vendor whitelist examples: OnlyFans, Zara, H&M, Victoria's Secret, Sephora, Netflix, Spotify, Apple Store (personal electronics may be allowed per policy)
Match heuristics:
- Exact vendor token match in merchant or OCR text -> high confidence
- Merchant appears in known personal brand list -> high confidence
- If line items include clothing, cosmetics, subscription services and merchant is general retailer -> lower confidence
Evidence examples: "vendor-token:OnlyFans", "line-item:subscription", "merchant-domain:onlyfans.com"

EVIDENCE FORMAT:
Every evidence entry must be a short token or phrase using hyphen separated words, for example:
- "no-exif"
- "image-hash-match"
- "phash-similarity:4"
- "ocr-similarity:97"
- "vendor-token:OnlyFans"
- "line-item:beer"
- "domain-mismatch:merchant/domain"
- "impossible-total"

ACTIONABLE OUTPUTS:
- If suspicious_fraude.value === true and confidence >= 0.75, include in notes: "Hold for manual review - potential AI-generated receipt"
- If duplicate.value === true and confidence >= 0.9, include in notes: "Auto-reject duplicate" or include duplicate_of id for de-dupe pipeline
- If unauthorized_category.value === true and categories includes Gambling or Alcohol and confidence >= 0.7, notes: "Flag for policy violation - require approver"
- If suspicious_personal.value === true and confidence >= 0.7, notes: "Flag as personal expense"

Return JSON only. Do not include explanations, code fences, or extra text.` 
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
          let errorMessage = 'Failed to process with AI';
          
          try {
            // Read response as text first (we can only read once)
            const errorText = await response.text();
            
            // Filter out prompt text - if it contains the prompt signature, it's likely not a real error message
            if (errorText.length > 5000 || errorText.includes('SYSTEM: You are a deterministic') || errorText.includes('OUTPUT SCHEMA:')) {
              console.error('Gemini API error:', response.status, 'Response appears to contain prompt, not error message');
              errorMessage = `API error (status ${response.status}). Please check API key and quota.`;
            } else {
              // Try to parse as JSON (Gemini API usually returns JSON errors)
              try {
                const errorData = JSON.parse(errorText);
                // Extract meaningful error message from Gemini API response
                if (errorData.error && errorData.error.message) {
                  errorMessage = errorData.error.message;
                } else if (errorData.error && errorData.error.details && errorData.error.details[0] && errorData.error.details[0].message) {
                  errorMessage = errorData.error.details[0].message;
                } else if (typeof errorData.error === 'string') {
                  errorMessage = errorData.error;
                } else if (errorData.message) {
                  errorMessage = errorData.message;
                }
                console.error('Gemini API error:', response.status, JSON.stringify(errorData, null, 2));
              } catch (jsonError) {
                // Not JSON, use text (but truncate if too long)
                console.error('Gemini API error (text):', response.status, errorText.substring(0, 500));
                errorMessage = errorText.substring(0, 200);
              }
            }
          } catch (readError) {
            console.error('Gemini API error:', response.status, 'Could not read error response:', readError);
            errorMessage = `API error (status ${response.status}). Please check API key and quota.`;
          }
          
          results.push({
            filename: file.originalname,
            error: errorMessage
          });
          continue;
        }

        const data = await response.json();
        const fullContent = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
        
        // Parse JSON response
        let jsonReceipts = [];
        let lineItems = [];
        
        try {
          // Clean the content - remove markdown code fences if present
          let cleanContent = fullContent.trim();
          
          // Remove markdown code blocks if present
          cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          
          // Try to parse as JSON array
          const parsed = JSON.parse(cleanContent);
          jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
          
          console.log(`✅ Parsed ${jsonReceipts.length} receipt(s) from JSON for ${file.originalname}`);
        } catch (parseError) {
          console.error(`Failed to parse JSON response for ${file.originalname}:`, parseError);
          console.error('Response content:', fullContent.substring(0, 500));
          
          // Fallback: try to extract JSON from text
          const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
              console.log(`✅ Extracted JSON from text for ${file.originalname}`);
            } catch (e) {
              console.error('Failed to extract JSON from text:', e);
              results.push({
                filename: file.originalname,
                error: 'Failed to parse AI response as JSON'
              });
              continue;
            }
          } else {
            results.push({
              filename: file.originalname,
              error: 'Failed to parse AI response as JSON'
            });
            continue;
          }
        }
        
        // Process each receipt from JSON
        for (const receipt of jsonReceipts) {
          // Extract invoice number from receipt (must be extracted from document, not generated)
          const invoiceNumber = receipt.invoice_number || '';
          
          // Extract line items if present
          if (receipt.line_items && Array.isArray(receipt.line_items)) {
            for (const item of receipt.line_items) {
              lineItems.push({
                invoiceNumber: invoiceNumber,
                description: item.description || '',
                date: item.date || receipt.date || '',
                amount: item.amount !== undefined ? String(item.amount) : '',
                category: item.category || ''
              });
            }
          }
          
          // Convert JSON receipt to CSV row
          const csvRow = jsonToCSVRow(receipt);
          
          results.push({
            filename: file.originalname,
            csv: csvRow,
            lineItems: receipt.line_items && receipt.line_items.length > 0 ? 
              receipt.line_items.map(item => ({
                invoiceNumber: invoiceNumber,
                description: item.description || '',
                date: item.date || receipt.date || '',
                amount: item.amount !== undefined ? String(item.amount) : '',
                category: item.category || ''
              })) : undefined
          });
        }
        
        if (lineItems.length > 0) {
          console.log(`✅ Extracted ${lineItems.length} line items for ${file.originalname}`);
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
    
    // Post-process: Detect duplicates across all files and collect line items
    // Parse all CSV rows and check for duplicates
    const allRows = [];
    const allLineItems = new Map(); // Map invoice number to line items
    
    // Helper function to parse CSV line with quoted values
    function parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Add last field
      return values;
    }
    
    for (const result of results) {
      if (result.csv) {
        const lines = result.csv.trim().split('\n');
        for (const line of lines) {
          if (line.trim() && !line.trim().startsWith('Invoice Number')) { // Skip header
            const values = parseCSVLine(line);
            if (values.length >= 6) {
              // Clean and trim all values (parseCSVLine already trims, but ensure quotes are removed and trimmed again)
              const cleanValue = (val) => (val || '').replace(/^"|"$/g, '').trim();
              
              const invoiceNum = cleanValue(values[0]);
              
              // Find line items for this invoice number
              const rowLineItems = (result.lineItems && Array.isArray(result.lineItems)) ? result.lineItems.filter(li => li.invoiceNumber === invoiceNum) : [];
              
              // Store line items in map
              if (invoiceNum && rowLineItems.length > 0) {
                if (!allLineItems.has(invoiceNum)) {
                  allLineItems.set(invoiceNum, []);
                }
                allLineItems.get(invoiceNum).push(...rowLineItems);
              }
              
              allRows.push({
                invoiceNumber: invoiceNum,
                date: cleanValue(values[1]),
                amount: cleanValue(values[2]),
                currency: cleanValue(values[3]),
                merchant: cleanValue(values[4]),
                transactionType: cleanValue(values[5]) || 'Other',
                fraudRisk: cleanValue(values[6]) || 'Low',
                duplicate: cleanValue(values[7]) || 'No',
                alcoholTobacco: cleanValue(values[8]) || 'No',
                personalExpense: cleanValue(values[9]) || 'No',
                notes: cleanValue(values[10]) || ''
              });
            }
          }
        }
      }
    }
    
    // Normalize values for duplicate comparison
    const normalizeForDuplicate = (row) => {
      // Normalize merchant: trim, lowercase, collapse multiple spaces
      const merchant = (row.merchant || '').trim().toLowerCase().replace(/\s+/g, ' ');
      
      // Normalize date: trim
      const date = (row.date || '').trim();
      
      // Normalize amount: remove currency symbols, parse to float, normalize decimals
      const amountStr = (row.amount || '').toString().trim();
      const amount = parseFloat(amountStr.replace(/[^\d.-]/g, '')) || 0;
      const normalizedAmount = amount.toFixed(2);
      
      return { merchant, date, amount: normalizedAmount };
    };
    
    // Detect duplicates: check by invoice number first (strongest signal), then merchant+date+amount
    const seen = new Map(); // merchant|date|amount
    const seenByInvoice = new Map(); // invoice number -> index
    
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      
      // Check by invoice number first (strongest duplicate signal)
      if (row.invoiceNumber && row.invoiceNumber.trim()) {
        const invoiceKey = row.invoiceNumber.trim();
        if (seenByInvoice.has(invoiceKey)) {
          const firstIndex = seenByInvoice.get(invoiceKey);
          allRows[firstIndex].duplicate = 'Yes';
          row.duplicate = 'Yes';
          console.log(`✓ Duplicate detected by invoice number: "${invoiceKey}" (rows ${firstIndex} and ${i})`);
          continue;
        } else {
          seenByInvoice.set(invoiceKey, i);
        }
      }
      
      // Check by merchant+date+amount (normalized)
      const normalized = normalizeForDuplicate(row);
      const key = `${normalized.merchant}|${normalized.date}|${normalized.amount}`;
      
      if (seen.has(key)) {
        // Mark both the first occurrence and this one as duplicates
        const firstIndex = seen.get(key);
        allRows[firstIndex].duplicate = 'Yes';
        row.duplicate = 'Yes';
        console.log(`✓ Duplicate detected by merchant+date+amount: merchant="${normalized.merchant}", date="${normalized.date}", amount="${normalized.amount}" (rows ${firstIndex} and ${i})`);
      } else {
        seen.set(key, i);
      }
    }
    
    // Rebuild CSV with updated duplicate flags
    const csvHeader = "Invoice Number,Date,Amount,Currency,Merchant,Transaction Type,Fraud Risk,Duplicate,Alcohol/Tobacco,Personal Expense,Notes";
    const csvRows = allRows.map(row => {
      return [
        row.invoiceNumber || '',
        row.date || '',
        row.amount || '',
        row.currency || '',
        row.merchant || '',
        row.transactionType || '',
        row.fraudRisk || 'Low',
        row.duplicate || 'No',
        row.alcoholTobacco || 'No',
        row.personalExpense || 'No',
        row.notes || ''
      ].join(',');
    });
    const finalCsv = [csvHeader, ...csvRows].join('\n');
    
    // Structure response with line items
    const lineItemsArray = Array.from(allLineItems.entries()).map(([invoiceNumber, items]) => ({
      invoiceNumber: invoiceNumber,
      lineItems: items.map((item) => ({
        description: item.description || '',
        date: item.date || '',
        amount: item.amount || '',
        category: item.category || ''
      }))
    })).filter(item => item.lineItems.length > 0);
    
    const responseData = {
      csv: finalCsv,
      lineItems: lineItemsArray
    };
    
    console.log('Extraction completed successfully');
    const duplicateCount = allRows.filter(r => r.duplicate === 'Yes').length;
    const fraudRiskCount = allRows.filter(r => r.fraudRisk === 'High' || r.fraudRisk === 'Medium').length;
    const alcoholTobaccoCount = allRows.filter(r => r.alcoholTobacco === 'Yes').length;
    const personalExpenseCount = allRows.filter(r => r.personalExpense === 'Suspicious Personal').length;
    
    console.log(`📊 Summary: ${allRows.length} receipts processed`);
    if (duplicateCount > 0) {
      console.log(`  ⚠️  ${duplicateCount} duplicate receipt(s) detected`);
    }
    if (fraudRiskCount > 0) {
      console.log(`  🛡️  ${fraudRiskCount} receipt(s) with fraud risk (Medium/High)`);
    }
    if (alcoholTobaccoCount > 0) {
      console.log(`  🍷 ${alcoholTobaccoCount} receipt(s) contain alcohol/tobacco`);
    }
    if (personalExpenseCount > 0) {
      console.log(`  👤 ${personalExpenseCount} suspicious personal expense(s) detected`);
    }
    
    const totalLineItems = lineItemsArray.reduce((sum, item) => sum + item.lineItems.length, 0);
    if (totalLineItems > 0) {
      console.log(`  📋 ${totalLineItems} total line items extracted across all receipts`);
    }
    
    res.status(200).json(responseData);

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
