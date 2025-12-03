const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
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
function jsonToCSVRow(receipt, receiptIdMap = {}) {
  // Map fraud risk from confidence
  let fraudRisk = 'Low';
  if (receipt.flags?.suspicious_fraud_risk?.value === true) {
    const conf = receipt.flags.suspicious_fraud_risk.confidence || 0;
    if (conf >= 0.75) fraudRisk = 'High';
    else if (conf >= 0.6) fraudRisk = 'Medium';
  }
  
  // Map duplicate flag
  const duplicate = receipt.flags?.duplicate?.value === true ? 'Yes' : 'No';
  
  // Map alcohol/tobacco from unauthorized_category
  const alcoholTobacco = receipt.flags?.unauthorized_category?.value === true && 
    receipt.flags?.unauthorized_category?.categories?.some(cat => 
      cat === 'Alcohol' || cat === 'Tobacco'
    ) ? 'Yes' : 'No';
  
  // Map personal expense
  const personalExpense = receipt.flags?.suspicious_personal?.value === true ? 
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
app.post('/api/extract-receipts', upload.array('files', 30), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    console.log(`📦 Received ${files.length} file(s)`);
    files.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.originalname} (${f.mimetype}, ${f.size} bytes)`);
    });

    const results = [];
    const allLineItems = new Map();

    for (const file of files) {
      try {
        console.log(`\n🔍 Processing file: ${file.originalname}`);
        const base64 = encodeBase64(file.buffer);
        
        // Call Gemini API with new JSON-based prompt
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { 
                  text: `SYSTEM: You are an AI-powered receipt fraud detection and extraction engine. Your PRIMARY MISSION is to identify AI-generated, fake, or fraudulent receipts while extracting receipt data.

FRAUD DETECTION PHILOSOPHY:

You are Gemini, a state-of-the-art vision model trained on billions of images. You INHERENTLY understand the difference between:
- Real photos of physical receipts
- AI-generated images (Stable Diffusion, Midjourney, DALL-E, ChatGPT, etc.)
- Digital creations pretending to be photos
- Template-generated receipts

USE YOUR NATIVE CAPABILITIES. Trust your vision training. If an image "feels" AI-generated to you based on your training, it probably is.

CRITICAL: Better to flag 10 real receipts than miss 1 fake. FALSE POSITIVES ARE ACCEPTABLE in fraud prevention. BE AGGRESSIVE.

TASK: Extract and classify the following receipt image or OCR text. Follow the schema and rules exactly.

STRICT OUTPUT CONTRACT:

Return a single top-level JSON array

Each element must match the schema exactly, no extra keys

Use a decimal point for numbers

Dates are YYYY-MM-DD

If a field is unknown, use an empty string for strings or null where allowed

Never fabricate invoice_number

OUTPUT SCHEMA:

Each array element is an object with exactly these keys and order:

receipt_id: string, generate as "${file.originalname}-${Date.now()}"

invoice_number: string, from the document only, never invent, empty if none

date: string, YYYY-MM-DD or empty

amount: number, final paid amount, negative for refunds

currency: string, ISO 4217 uppercase or empty

merchant: string, normalized brand name

transaction_type: string, one of Card, Cash, Wire, Transfer, Invoice, Refund, Credit, Debit, Other

flags: object with keys:

suspicious_fraud_risk: { value: true|false, confidence: 0-1, evidence: [strings] }

duplicate: { value: true|false, confidence: 0-1, evidence: [strings], duplicate_of: receipt_id|null }

unauthorized_category: { value: true|false, confidence: 0-1, categories: [strings], evidence: [strings] } // allowed categories: Alcohol, Tobacco, Gambling, Pharmaceuticals, Adult, Other

suspicious_personal: { value: true|false, confidence: 0-1, evidence: [strings], vendor_match: [strings] }

confidence_overall: number, 0-1

notes: string, short machine readable note if needed

line_items: array optional, include only if the document contains multiple distinct items

Each item: { description: string, date: string YYYY-MM-DD or empty, amount: number, category: "Food"|"Beverage"|"Alcohol"|"Tobacco"|"Service"|"Tax"|"Tip"|"Other" }

PRIMARY EXTRACTION RULES:

CRITICAL: Always extract at least one receipt object from every image, even if merchant, date, or invoice_number are missing. Missing fields should be empty strings, never cause rejection. A receipt with only amount and line items is still valid.

Date: prefer payment or settlement date, if only month and year, use first day of that month, normalize to YYYY-MM-DD. If no date visible, use empty string.

Amount: use the final Total or Amount paid, do not recompute when a final total exists, strip symbols and thousands separators

Currency: map symbol to ISO code when clear, otherwise empty

Merchant: remove legal suffixes such as Inc, Ltd, LLC, GmbH, prefer the visible brand. If no merchant name visible, use empty string.

Transaction type: if a card brand or last 4 appears, set Card, for refunds, set Refund and make the amount negative. If unclear, use "Other"

FLAGGING RULES:

suspicious_fraud_risk:

AI DETECTION PHILOSOPHY: Distinguish between LEGITIMATE DIGITAL INVOICES and AI-GENERATED FAKE RECEIPTS. Many real businesses issue clean digital invoices - this is normal. Focus on BUSINESS LEGITIMACY and CONTENT AUTHENTICITY.

CRITICAL DISTINCTION:

LEGITIMATE DIGITAL INVOICES are common:
- Amazon, eBay, Shopify → PDF invoices (clean, professional, digital)
- Software companies → Email receipts
- Hotels, airlines, Uber → Digital confirmations
- These are CLEAN and DIGITAL - this is NORMAL and LEGITIMATE

Your job: Detect FAKE/FRAUDULENT receipts, not flag legitimate digital business documents.

LEGITIMACY INDICATORS (DON'T FLAG if present):

1. REAL BUSINESS VERIFICATION:
   - Specific legal business name: "TULU TECH LTD", "Amazon Services LLC", "Marriott International Inc"
   - Complete real addresses with street numbers, postal codes, actual cities
   - Valid tax/VAT IDs in proper format: "GB248042896", "EIN 12-3456789"
   - Real contact: actual domains (amazon.com, uber.com), proper emails, real phone formats
   - Business registration numbers following jurisdiction standards

2. KNOWN PLATFORMS:
   - Amazon, eBay, Etsy, Shopify invoices
   - Uber, Lyft, DoorDash receipts
   - Hotel/airline confirmations
   - Software/SaaS invoices
   - Professional digital format is EXPECTED and LEGITIMATE

3. AUTHENTIC CONTENT:
   - Specific product descriptions: "Syncwire Aux Cable 3.5mm", "Grande Latte", "Premium Gasoline"
   - Real order/invoice numbers with business-consistent formatting
   - Actual transaction details with proper dates
   - Verifiable business information

4. DIGITAL IS NORMAL:
   - Clean PDF invoice ≠ AI-generated
   - No camera EXIF is EXPECTED for PDFs/digital invoices
   - Professional formatting is LEGITIMATE
   - White background is STANDARD for business documents

FAKE/AI-GENERATED INDICATORS (FLAG THESE):

1. PLACEHOLDER/TEMPLATE:
   - Generic merchant: "SHOP'S NAME", "Store", "Business Name", "Merchant", "[Company]", one-word names like "Shop" or "Store"
   - Lorem Ipsum: "Lorem", "Ipsum", "Dolor sit amet", "Consectetur" anywhere
   - Template items: "Item 1", "Item 2", "Product A", "Service", "Purchase"
   - Fake phone: "123-456-7890", "+1 012 345 67 89", sequential/obvious fakes
   - Placeholder address: "Lorem Ipsum, 12345", "123 Main St" only

2. TEST/DUMMY DATA:
   - "Test Store", "Sample Restaurant", "Example Corp", "Demo Business"
   - Generic descriptions with no specificity

3. AI-PHOTO FRAUD (photo claims but AI quality):
   - Claims to be phone photo but impossibly perfect (zero blur/noise)
   - Obvious AI art aesthetics
   - Photo with vector-quality text (impossible with cameras)

4. IMPOSSIBLE BUSINESS:
   - Merchant doesn't exist online
   - Invalid VAT/tax format
   - Fake addresses

ANALYSIS DECISION TREE:

Step 1: INSTANT FAKE CHECK
→ "SHOP'S NAME", Lorem Ipsum, "Item 1" items? → FLAG confidence 0.95, STOP

Step 2: LEGITIMACY CHECK
→ Real business (Amazon, Uber, etc.) + valid VAT/address? → DON'T FLAG confidence 0.0, STOP

Step 3: DOCUMENT TYPE
→ Digital invoice/PDF from real business? → LEGITIMATE, don't flag
→ Photo claiming receipt but AI quality? → Suspicious, investigate

Step 4: BALANCE ASSESSMENT
→ More legitimacy signals than fake? → Don't flag
→ More fake signals? → Flag

CONFIDENCE SCORING:

- 0.95: Fake (SHOP'S NAME, Lorem Ipsum, template)
- 0.85: Very likely fake (generic, no real business details)
- 0.75: Probably fake (placeholders outweigh legitimacy)
- 0.65: Leaning fake
- 0.50: Uncertain → CHECK LEGITIMACY FIRST
- 0.30: Probably legitimate (real business indicators)
- 0.00: Clearly legitimate (Amazon, known business, valid details)

Threshold: >= 0.6 to flag

CRITICAL: DO NOT FLAG legitimate digital invoices from real businesses (Amazon, Uber, hotels, software). Focus on detecting FRAUDULENT FAKE receipts with placeholder/template content.

duplicate:

Scope is within the same image or batch only

Set value true when any apply, include duplicate_of when available

image-hash-match, exact duplicate in image or batch

phash-similarity:X, perceptual near duplicate, Hamming distance threshold for near match

ocr-similarity:XX, normalized similarity for merchant+date+amount above 95 percent

merchant-amount-date-match, same merchant, amount, date within 1 day and near-identical card last4

same-invoice-number, the same invoice_number appears again in the same image or batch

If only one receipt is processed in this call, set duplicate.value false

unauthorized_category:

Set value true when merchant or line items indicate forbidden categories

Keyword anchors

Alcohol: wine, beer, liquor, bar, brewery, pub, spirits, vodka, gin, rum, whiskey, whisky, tequila, bourbon, scotch, brandy, cognac, champagne, prosecco, sake, mezcal, absinthe, liqueur, cordial, cocktail, margarita, martini, mojito, sangria

Tobacco: cigarette, cigar, tobacco, vape, vaping, e-cigarette, e-cig, hookah, shisha, snuff, chewing tobacco

Gambling: casino, sportsbook, bet, wager, slot, poker, roulette, blackjack, baccarat, craps, lottery, scratch card, betting, gambling

Adult: onlyfans, porn, xxx, cam, adult store, strip club, adult entertainment, escort

Pharmaceuticals: pharmacy, prescription, rx, medication, drugs (when clearly non-prescription or recreational)

Evidence strings must reference tokens found, for example line-item:beer, line-item:vodka, line-item:whiskey, merchant-token:pub, vendor-token:OnlyFans

suspicious_personal:

Recognize clear personal spend, including brands like OnlyFans, Zara, H&M, Victoria's Secret, Sephora, Shein, Temu, Netflix, Spotify, Apple App Store, Google Play, Uber Eats, Deliveroo, DoorDash, Steam, Epic Games

Heuristics

Exact vendor token in merchant, domain, or receipt header, high confidence

Line items strongly personal without business context, medium confidence

Generic marketplaces require item evidence, lower confidence

Evidence examples: vendor-token:Zara, merchant-domain:onlyfans.com, line-item:subscription, line-item:cosmetics

EVIDENCE FORMAT:

Short tokens or token:value pairs only

Examples: no-exif, image-hash-match, phash-similarity:4, ocr-similarity:97, vendor-token:OnlyFans, line-item:beer, domain-mismatch:merchant/domain, impossible-total, phone-format-invalid, invalid-tax-id:GB

ACTIONABLE OUTPUTS:

If suspicious_fraud_risk.value true and confidence >= 0.75, notes = "Suspicious Fraud (AI-Generated) - Hold for manual review"

If suspicious_fraud_risk.value true and confidence 0.6-0.75, notes = "Suspicious Fraud (AI-Generated) - Verify authenticity"

If duplicate.value true and confidence >= 0.9, notes = "Auto reject duplicate", include duplicate_of

If unauthorized_category.value true and categories contains Alcohol or Gambling and confidence >= 0.7, notes = "Flag for policy violation, require approver"

If suspicious_personal.value true and confidence >= 0.7, notes = "Flag as personal expense"

LINE ITEM EXTRACTION:

Include line_items only when multiple distinct items are present, do not add an empty array

Each item must have description and amount, add category if clear

ROBUSTNESS RULES:

Never fabricate invoice_number. If not visible, use empty string.

ALWAYS return at least one receipt object per image, even if many fields are missing. Missing merchant, date, or invoice_number should never cause an empty array response.

If totals conflict, prefer the final Total or Amount paid, then add mismatch-total-lines to evidence

If merchant appears as a domain or email, normalize to brand when obvious and add merchant-domain:brand.tld to evidence

If OCR is low confidence, leave unreadable fields empty

For alcohol detection: recognize spirit names (vodka, gin, rum, whiskey, tequila, etc.) in line items even if merchant name doesn't indicate alcohol. Use semantic understanding - if line items contain alcohol product names, flag as Alcohol category.`
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
        const fullContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Log raw response for debugging
        console.log(`📄 Raw Gemini response for ${file.originalname} (${fullContent.length} chars):`);
        if (fullContent.length < 500) {
          console.log(`   Full content: ${fullContent}`);
        } else {
          console.log(`   First 500 chars: ${fullContent.substring(0, 500)}`);
          console.log(`   Last 200 chars: ${fullContent.substring(fullContent.length - 200)}`);
        }
        
        // Parse JSON response
        let jsonReceipts = [];
        let lineItems = [];
        
        try {
          // Remove markdown code fences if present
          let jsonContent = fullContent;
          if (jsonContent.includes('```')) {
            const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              jsonContent = jsonMatch[1];
            }
          }
          
          const parsed = JSON.parse(jsonContent.trim());
          jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
          
          // Log parsed receipt count
          console.log(`✅ Parsed ${jsonReceipts.length} receipt(s) from JSON for ${file.originalname}`);
          
          // Log fraud detection results
          jsonReceipts.forEach((receipt, idx) => {
            const fraudFlag = receipt.flags?.suspicious_fraud_risk;
            if (fraudFlag?.value === true) {
              console.log(`   ⚠️  Receipt ${idx + 1} flagged for fraud: confidence=${fraudFlag.confidence}, evidence=${JSON.stringify(fraudFlag.evidence)}`);
            }
            const alcoholFlag = receipt.flags?.unauthorized_category;
            if (alcoholFlag?.value === true && alcoholFlag.categories?.some(c => c === 'Alcohol' || c === 'Tobacco')) {
              console.log(`   🍷 Receipt ${idx + 1} contains alcohol/tobacco: categories=${JSON.stringify(alcoholFlag.categories)}`);
            }
          });
          
        } catch (parseError) {
          console.error(`❌ Failed to parse JSON response for ${file.originalname}:`, parseError.message);
          console.error(`   Response content (first 1000 chars):`, fullContent.substring(0, 1000));
          
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
        if (jsonReceipts.length === 0) {
          console.error(`❌ ERROR: File ${file.originalname} produced 0 receipts from Gemini API`);
          console.error(`   Full response content (first 1000 chars):`, fullContent.substring(0, 1000));
          console.error(`   This violates the prompt requirement to ALWAYS return at least one receipt object.`);
          
          // FALLBACK: Create a minimal receipt object to prevent complete failure
          // This ensures the flagging system still receives data to process
          console.warn(`   Creating fallback receipt object with minimal data...`);
          const fallbackReceipt = {
            receipt_id: `${file.originalname}-${Date.now()}`,
            invoice_number: '',
            date: '',
            amount: 0,
            currency: '',
            merchant: '',
            transaction_type: 'Other',
            flags: {
              suspicious_fraud_risk: { value: false, confidence: 0, evidence: [] },
              duplicate: { value: false, confidence: 0, evidence: [], duplicate_of: null },
              unauthorized_category: { value: false, confidence: 0, categories: [], evidence: [] },
              suspicious_personal: { value: false, confidence: 0, evidence: [], vendor_match: [] }
            },
            confidence_overall: 0,
            notes: 'Failed to extract receipt data - Gemini returned empty array',
            line_items: []
          };
          jsonReceipts = [fallbackReceipt];
          console.warn(`   Using fallback receipt to prevent data loss`);
        }
        
        // Process receipts (now guaranteed to have at least one)
        for (const receipt of jsonReceipts) {
          // Extract line items if present
          if (receipt.line_items && Array.isArray(receipt.line_items) && receipt.line_items.length > 0) {
            const invoiceKey = receipt.invoice_number || receipt.receipt_id || file.originalname;
            if (!allLineItems.has(invoiceKey)) {
              allLineItems.set(invoiceKey, []);
            }
            allLineItems.get(invoiceKey).push(...receipt.line_items);
          }
        }
        
        // Convert receipts to CSV format
        const csvRows = jsonReceipts.map(receipt => jsonToCSVRow(receipt));
        const csv = csvRows.join('\n');
        
        results.push({
          filename: file.originalname,
          csv: csv,
          receipts: jsonReceipts
        });
        
        console.log(`✅ Successfully processed ${file.originalname}: ${jsonReceipts.length} receipt(s)`);
        
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        results.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    // Post-process: Detect duplicates across all files and collect line items
    // Parse all CSV rows and check for duplicates
    const allRows = [];
    
    results.forEach(result => {
      if (result.csv) {
        const rows = result.csv.split('\n').filter(row => row.trim());
        rows.forEach(row => {
          const values = row.split(',');
          const obj = {
            invoiceNumber: values[0] || '',
            date: values[1] || '',
            amount: values[2] || '',
            currency: values[3] || '',
            merchant: values[4] || '',
            transactionType: values[5] || '',
            fraudRisk: values[6] || 'Low',
            duplicate: values[7] || 'No',
            alcoholTobacco: values[8] || 'No',
            personalExpense: values[9] || 'No',
            notes: values[10] || ''
          };
          allRows.push(obj);
        });
      }
    });
    
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
    
    // Count files with errors vs success
    const filesWithErrors = results.filter(r => r.error).length;
    const filesWithCSV = results.filter(r => r.csv).length;
    const totalFilesProcessed = results.length;
    
    console.log(`📁 Files processed: ${totalFilesProcessed} total, ${filesWithCSV} successful, ${filesWithErrors} errors`);
    
    const duplicateCount = allRows.filter(r => r.duplicate === 'Yes').length;
    const fraudRiskCount = allRows.filter(r => r.fraudRisk === 'High' || r.fraudRisk === 'Medium').length;
    const alcoholTobaccoCount = allRows.filter(r => r.alcoholTobacco === 'Yes').length;
    const personalExpenseCount = allRows.filter(r => r.personalExpense === 'Suspicious Personal').length;
    
    console.log(`📊 Summary: ${allRows.length} receipts extracted from ${filesWithCSV} successful files`);
    
    if (filesWithErrors > 0) {
      console.warn(`⚠️ ${filesWithErrors} file(s) failed to extract:`);
      results.filter(r => r.error).forEach(r => {
        console.warn(`  - ${r.filename}: ${r.error}`);
      });
    }
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
    console.error('Server error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Receipt Data Extractor API is running' });
});

// Use Resend for email sending (simpler than SMTP)
// Initialize lazily to avoid errors when API key is not set
const { Resend } = require('resend');
let resend = null;

function getResend() {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error('Resend API key not configured');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

// Utility to convert array of objects to CSV
function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') 
      ? `"${s.replace(/"/g, '""')}"` 
      : s;
  };
  
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => esc(r[h])).join(','))
  ];
  
  return lines.join('\n');
}

// Send CSV endpoint
app.post('/api/send-csv', async (req, res) => {
  try {
    const { email, rows, filename = 'mesh-receipts.csv' } = req.body;

    // Basic validation
    if (!email || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Domain filter on server as well
    const blocked = new Set([
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
      'aol.com', 'proton.me', 'zoho.com', 'gmx.com', 'yandex.com', 'live.com', 'msn.com'
    ]);
    
    const domain = String(email).toLowerCase().split('@')[1] || '';
    if (blocked.has(domain)) {
      return res.status(400).json({ error: 'Business email required' });
    }

    const csv = toCSV(rows);
    console.log('[send-csv] CSV generated, length:', csv.length);

    // Check API key configuration and initialize Resend
    let resendInstance;
    try {
      resendInstance = getResend();
    } catch (e) {
      console.error('[send-csv] Email service API key not configured');
      return res.status(500).json({ error: 'Email service not configured. Please set RESEND_API_KEY.' });
    }

    // Convert CSV to Buffer for attachment (Resend accepts Buffer or base64 string)
    const csvBuffer = Buffer.from(csv, 'utf-8');

    // Send email with attachment using Resend
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const adminEmail = 'eran.samra@meshpayments.com';
    
    console.log('[send-csv] Sending email with BCC to admin:', adminEmail);
    
    const { data, error } = await resendInstance.emails.send({
      from: emailFrom,
      to: email,
      bcc: adminEmail, // BCC admin on all CSV emails
      subject: 'Your CSV from Mesh AI is ready',
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; color:#222222; max-width:560px;">
          <p>Hi,</p>

          <p>Your CSV from Mesh AI is attached.</p>

          <p>
            Mesh AI is part of 
            <a href="https://www.meshpayments.com/?utm_source=mesh-ai-tool&utm_medium=email&utm_campaign=receipt-to-csv&utm_content=email-body" 
               style="color:#1a73e8; text-decoration:underline;">
              Mesh Payments
            </a>, a spend and travel platform that turns receipts into clean, compliant data and flags anomalies in real time.
          </p>

          <p>
            Eran Samra<br>
            Product &amp; AI, Mesh Payments
          </p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: csvBuffer, // Resend accepts Buffer directly
        }
      ]
    });

    if (error) {
      console.error('[send-csv] Resend error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('[send-csv] Email sent successfully:', data?.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Error sending CSV email:', e);
    return res.status(500).json({ error: 'Send failed' });
  }
});

// Signup notification endpoint
app.post('/api/notify-signup', async (req, res) => {
  try {
    const { userEmail, userId } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Check API key configuration and initialize Resend
    let resendInstance;
    try {
      resendInstance = getResend();
    } catch (e) {
      console.error('[notify-signup] Email service API key not configured');
      return res.status(500).json({ error: 'Email service not configured. Please set RESEND_API_KEY.' });
    }

    const adminEmail = 'eran.samra@meshpayments.com';
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    console.log('[notify-signup] Sending signup notification...');
    console.log('[notify-signup] New user:', userEmail);
    console.log('[notify-signup] Notifying:', adminEmail);

    // Send notification email to admin
    const { data, error } = await resendInstance.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: 'New User Signup - Receipt to CSV Bot',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New User Signup Notification</h2>
          <p>A new user has signed up for the Receipt to CSV Bot:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
            ${userId ? `<p style="margin: 5px 0;"><strong>User ID:</strong> ${userId}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Signup Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">This is an automated notification from the Receipt to CSV Bot.</p>
        </div>
      `,
    });

    if (error) {
      console.error('[notify-signup] Resend error:', error);
      throw new Error(error.message || 'Failed to send notification email');
    }

    console.log('[notify-signup] Notification email sent successfully:', data?.id);
    return res.status(200).json({ ok: true, messageId: data?.id });
  } catch (e) {
    console.error('[notify-signup] Error sending notification email:', e);
    return res.status(500).json({ 
      error: e.message || 'Failed to send notification email',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Receipt Scanner Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Gemini API Key: ${GEMINI_API_KEY ? 'Configured' : 'Not configured'}`);
});
