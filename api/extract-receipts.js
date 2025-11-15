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
                  text: `SYSTEM: You are a deterministic receipt extraction and policy classification engine for enterprise expense management. Extract fields, classify fraud and policy risks, then return a single JSON array of receipt objects. Be conservative when flagging. Provide evidence for every non-empty flag. Return JSON only, no extra text.

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

receipt_id: string, generate as "${file.filename}-${Date.now()}"

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

DETECTION FRAMEWORK: Multi-factor analysis for AI-generated receipts. Flag as true when combined confidence >= 0.6. Use cumulative evidence scoring.

CATEGORY 1: AI GENERATION SIGNATURES (High Weight: +0.35 each)

- "ai-perfect-symmetry" - Unnaturally perfect alignment, pixel-perfect spacing
- "synthetic-texture" - Generated paper texture (uniform grain, repeated patterns)
- "digital-native" - Pure digital generation (perfect white background, no shadows, vector-sharp edges)
- "ai-font-rendering" - Text artifacts typical of AI (synthetic kerning, mathematical spacing)
- "stable-diffusion-artifacts" - Repeated micro-structures, gaussian halos, edge coherence issues
- "prompt-leakage" - Text fragments like "Generate receipt", "Create invoice"
- "chatgpt-format" - Markdown syntax, code formatting in receipt text
- "watermark-traces" - Faint AI service watermarks even if partially removed

CATEGORY 2: METADATA RED FLAGS (High Weight: +0.35 each)

- "generator-metadata" - File contains: "Adobe Firefly", "Midjourney", "DALL-E", "Stable Diffusion", "Canva AI", "Photoshop Generative"
- "no-camera-exif" - Missing camera EXIF (Make, Model, DateTimeOriginal) when claiming to be photo
- "screenshot-only" - Screenshot metadata + resolution matches screens (1920x1080, 1366x768, 2560x1440)

CATEGORY 3: VISUAL ARTIFACTS (Medium Weight: +0.25 each)

- "impossible-lighting" - Lighting inconsistent with retail environment
- "vector-in-thermal" - Vector-quality elements in thermal receipt
- "layered-compositing" - Evidence of layer compositing (halos, misaligned elements)
- "synthetic-noise" - Algorithmic noise vs organic camera noise
- "too-perfect-ocr" - All text perfectly readable (real receipts have smudges, fading)

CATEGORY 4: CONTENT IMPOSSIBILITIES (Medium Weight: +0.25 each)

- "impossible-invoice-format" - Invoice number wrong format (test patterns: "INV-00001", "TEST-123")
- "merchant-not-found" - Merchant doesn't exist in business registries
- "test-data" - Names like "Test Store", "Sample Restaurant", "Lorem Ipsum"
- "generic-items" - Line items: "Item 1", "Product A", "Service"
- "tax-error" - Tax calculation impossible for jurisdiction
- "impossible-total" - Math doesn't add up (>$0.05 difference)
- "currency-location-mismatch" - USD in Europe-only merchant, GBP in US-only chain

CATEGORY 5: PATTERN ANOMALIES (Low Weight: +0.15 each)

- "round-numbers-only" - All amounts are round ($10, $25, $50)
- "font-inconsistency" - Multiple fonts in single-font medium (thermal)
- "impossible-thermal" - Color/gradients in thermal receipt
- "qr-fake" - QR code doesn't scan or contains test data

CONFIDENCE SCORING:

Calculate cumulative score from detected indicators:
- Score = sum of all indicator weights
- 0.0-0.3: Low confidence → Don't flag
- 0.3-0.6: Uncertain → Don't flag, but include evidence
- 0.6-0.8: High confidence → Flag with manual review
- 0.8+: Very high confidence → Likely AI-generated

REQUIRED EVIDENCE QUALITY:

- Minimum 2 different indicators to flag
- Prefer combining visual + content evidence
- Single weak indicator (only no-exif) = insufficient
- Multiple corroborating indicators = higher confidence

GEMINI VISION ANALYSIS:

As a vision model, analyze pixel-level patterns:
- Compression artifacts: Real vs AI compression patterns
- Color histograms: Natural vs synthetic distributions
- Edge detection: Real photo edges vs AI-rendered edges
- Noise patterns: Camera sensor noise vs algorithmic noise
- Texture analysis: Organic paper texture vs generated texture

Use your vision capabilities to detect patterns invisible to OCR.

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
            filename: file.filename,
            error: 'Failed to process with AI'
          });
          continue;
        }

        const data = await response.json();
        const fullContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Log raw response for debugging
        console.log(`📄 Raw Gemini response for ${file.filename} (${fullContent.length} chars):`);
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
          // Clean the content - remove markdown code fences if present
          let cleanContent = fullContent.trim();
          
          // Remove markdown code blocks if present
          cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          
          // Try to parse as JSON array
          const parsed = JSON.parse(cleanContent);
          jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
          
          console.log(`✅ Parsed ${jsonReceipts.length} receipt(s) from JSON for ${file.filename}`);
          
          // Validate that we got receipts
          if (jsonReceipts.length === 0) {
            console.error(`❌ CRITICAL: Parsed JSON but got empty array for ${file.filename}`);
          } else {
            // Log receipt details for debugging
            jsonReceipts.forEach((receipt, idx) => {
              console.log(`   Receipt ${idx + 1}: merchant="${receipt.merchant || '(empty)'}", amount=${receipt.amount || 0}, alcohol=${receipt.flags?.unauthorized_category?.categories?.includes('Alcohol') ? 'YES' : 'NO'}`);
            });
          }
        } catch (parseError) {
          console.error(`❌ Failed to parse JSON response for ${file.filename}:`, parseError.message);
          console.error(`   Response content (first 1000 chars):`, fullContent.substring(0, 1000));
          
          // Fallback: try to extract JSON from text
          const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
              console.log(`✅ Extracted JSON from text for ${file.filename}`);
            } catch (e) {
              console.error('Failed to extract JSON from text:', e);
              results.push({
                filename: file.filename,
                error: 'Failed to parse AI response as JSON'
              });
              continue;
            }
          } else {
            results.push({
              filename: file.filename,
              error: 'Failed to parse AI response as JSON'
            });
            continue;
          }
        }
        
        // Process each receipt from JSON
        if (jsonReceipts.length === 0) {
          console.error(`❌ ERROR: File ${file.filename} produced 0 receipts from Gemini API`);
          console.error(`   Full response content (first 1000 chars):`, fullContent.substring(0, 1000));
          console.error(`   This violates the prompt requirement to ALWAYS return at least one receipt object.`);
          
          // FALLBACK: Create a minimal receipt object to prevent complete failure
          // This ensures the flagging system still receives data to process
          console.warn(`   Creating fallback receipt object with minimal data...`);
          const fallbackReceipt = {
            receipt_id: `${file.filename}-${Date.now()}`,
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
        if (jsonReceipts.length > 0) {
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
              filename: file.filename,
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
            console.log(`✅ Extracted ${lineItems.length} line items for ${file.filename}`);
          }
          console.log(`✅ Successfully processed ${file.filename}: ${jsonReceipts.length} receipt(s) extracted`);
        }
        
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
              const rowLineItems = result.lineItems?.filter(li => li.invoiceNumber === invoiceNum) || [];
              
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
      lineItems: items.map((item: any) => ({
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