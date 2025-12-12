import { isExampleReceipt, getCachedResult, saveCachedResult, simulateProcessingDelay } from './cache-utils.js';

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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:152',message:'File processing start',data:{filename:file.filename,size:file.data.length,mimetype:file.mimetype},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Check if this is an example receipt and if we have cached results
        const isExample = isExampleReceipt(file.filename);
        console.log(`[Example Check] File: "${file.filename}" → isExample: ${isExample}`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:156',message:'Example detection result',data:{filename:file.filename,isExample:isExample},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        let cachedResult = null;
        
        if (isExample) {
          console.log(`[Example] Processing example receipt: ${file.filename}`);
          console.log(`[Cache] Checking database for example: ${file.filename}`);
          cachedResult = await getCachedResult(file.filename);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:161',message:'Cache check result',data:{filename:file.filename,hasCache:!!cachedResult,cacheType:Array.isArray(cachedResult)?'array':typeof cachedResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          if (cachedResult) {
            // Simulate processing delay to maintain realistic UX
            await simulateProcessingDelay();
            
            // Return cached result(s) - handle both single and array formats
            if (Array.isArray(cachedResult)) {
              // Multiple receipts cached
              cachedResult.forEach(cached => {
                results.push({
                  filename: file.filename,
                  csv: cached.csv,
                  lineItems: cached.lineItems || []
                });
              });
            } else {
              // Single receipt cached
              results.push({
                filename: file.filename,
                csv: cachedResult.csv,
                lineItems: cachedResult.lineItems || []
              });
            }
            console.log(`[Cache] ✅ Using cached result for ${file.filename}`);
            continue; // Skip Gemini API call
          } else {
            // This should never happen - examples have hardcoded results
            // But if it does, return an error instead of calling the API
            console.error(`[Cache] ❌ CRITICAL: Example receipt "${file.filename}" has no cache or hardcoded result. This should not happen.`);
            results.push({
              filename: file.filename,
              error: 'Example receipt data not found. Please contact support.'
            });
            continue; // Skip Gemini API call - examples should never reach the API
          }
        }
        
        // Check file size limit (1MB max)
        if (file.data.length > 1024 * 1024) {
          console.error(`File ${file.filename} is too large: ${file.data.length} bytes`);
          results.push({
            filename: file.filename,
            error: 'File too large. Maximum size is 1MB.'
          });
          continue;
        }
        
        // SAFETY CHECK: Double-check this is NOT an example before calling API
        // This prevents examples from calling Gemini even if detection failed earlier
        const doubleCheckIsExample = isExampleReceipt(file.filename);
        if (doubleCheckIsExample) {
          console.error(`[Cache] ❌ SAFETY CHECK FAILED: Example "${file.filename}" was about to call Gemini API!`);
          console.error(`[Cache] This should never happen - example detection should have caught this earlier.`);
          console.error(`[Cache] Blocking API call to prevent example from using Gemini.`);
          results.push({
            filename: file.filename,
            error: 'Example receipt detected. Examples should use cached results only.'
          });
          continue; // Block the API call
        }
        
        console.log(`[Non-Example] Processing regular receipt: ${file.filename} (will call Gemini API)`);
        
        // Convert to base64
        const base64 = encodeBase64(file.data);
        console.log(`Successfully encoded ${file.filename}`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:203',message:'Before Gemini API call',data:{filename:file.filename,base64Length:base64.length,hasApiKey:!!process.env.GEMINI_API_KEY,apiKeyPrefix:process.env.GEMINI_API_KEY?.substring(0,10)||'missing'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Call Gemini API (only for non-examples)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { 
                  text: `SYSTEM: You are an AI-powered receipt fraud detection and extraction engine.

FRAUD DETECTION PHILOSOPHY:
You are Gemini, a vision model trained on billions of images. You INHERENTLY understand the difference between real photos, AI-generated images (Stable Diffusion, Midjourney), digital creations, and templates. USE YOUR NATIVE CAPABILITIES. Trust your vision training.

CRITICAL: Better to flag 10 real receipts than miss 1 fake. FALSE POSITIVES ARE ACCEPTABLE. BE AGGRESSIVE.

TASK: Extract receipt data and classify fraud risks. Return JSON only.

OUTPUT SCHEMA:
Return a JSON array. Each element:
{
  "receipt_id": "generated-id",
  "invoice_number": "string from doc or empty",
  "date": "YYYY-MM-DD or empty",
  "amount": number (negative for refunds),
  "currency": "ISO code",
  "merchant": "normalized name",
  "transaction_type": "Card|Cash|Invoice|Other",
  "flags": {
    "suspicious_fraud_risk": { "value": boolean, "confidence": 0-1, "evidence": ["strings"] },
    "duplicate": { "value": boolean, "confidence": 0-1, "evidence": ["strings"], "duplicate_of": "id|null" },
    "unauthorized_category": { "value": boolean, "confidence": 0-1, "categories": ["strings"], "evidence": ["strings"] },
    "suspicious_personal": { "value": boolean, "confidence": 0-1, "evidence": ["strings"] }
  },
  "notes": "string",
  "line_items": [{ "description": "string", "date": "string", "amount": number, "category": "string" }]
}

FLAGGING RULES:

1. suspicious_fraud_risk (AI/Fake Detection):
   PHILOSOPHY: Distinguish between LEGITIMATE DIGITAL INVOICES (Amazon, Uber, software) and FAKE RECEIPTS.
   
   LEGITIMATE (Don't Flag):
   - Real business (Amazon, Uber, Apple, specific hotels)
   - Valid VAT/Tax IDs
   - Specific products ("Syncwire Cable" not "Item 1")
   - Clean digital PDF format is NORMAL for online businesses

   FAKE/AI (Flag Aggressively):
   - Placeholder merchant: "SHOP'S NAME", "STORE NAME", "MERCHANT", "[Name]" → CONFIDENCE 0.95
   - Lorem Ipsum text anywhere → CONFIDENCE 0.95
   - Template items: "Item 1", "Product A", "Service" → CONFIDENCE 0.90
   - Test data: "Test Store", "Sample", "Demo"
   - Perfect digital creation claiming to be physical receipt (no texture/shadows)
   - Visual artifacts: AI text rendering, impossible lighting, synthetic noise

   CONFIDENCE SCORING:
   - 0.95: Certain fake (placeholders, Lorem Ipsum)
   - 0.85: Likely fake (generic, AI visual tell-tales)
   - 0.60: Suspicious (flag to be safe)
   - 0.00: Legitimate business invoice

2. unauthorized_category:
   - Alcohol: beer, wine, spirits, liquor, cocktail
   - Tobacco: cigarettes, vape, cigar
   - Gambling: casino, bet, lottery
   - Adult: adult entertainment

3. suspicious_personal:
   - Personal brands: Netflix, Spotify, Steam, PSN, Xbox, OnlyFans, Zara, H&M
   - Items: clothing, cosmetics, video games, personal subscriptions

4. duplicate:
   - Scope: same batch only
   - Check: same invoice number OR same merchant+date+amount

ROBUSTNESS:
- Always return valid JSON array
- Missing fields = empty string
- Never fabricate data
- Trust your vision: if it looks AI-generated, flag it.` 
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:298',message:'Gemini API error response',data:{filename:file.filename,status:response.status,statusText:response.statusText,errorText:errorText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          results.push({
            filename: file.filename,
            error: 'Failed to process with AI'
          });
          continue;
        }

        const data = await response.json();
        const fullContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:308',message:'Gemini API success response',data:{filename:file.filename,contentLength:fullContent.length,hasCandidates:!!data.candidates,hasContent:!!fullContent},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:332',message:'JSON parse success',data:{filename:file.filename,receiptCount:jsonReceipts.length,isArray:Array.isArray(parsed)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:346',message:'JSON parse error',data:{filename:file.filename,error:parseError.message,contentPreview:fullContent.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
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
          
          // Save to cache if this is an example receipt (use persistent cache)
          if (isExample && jsonReceipts.length > 0) {
            // Collect all results for this file
            const fileResults = results.filter(r => r.filename === file.filename);
            if (fileResults.length > 0) {
              // Cache all receipts from this file
              const cacheData = fileResults.length === 1 
                ? {
                    csv: fileResults[0].csv,
                    lineItems: fileResults[0].lineItems || []
                  }
                : fileResults.map(r => ({
                    csv: r.csv,
                    lineItems: r.lineItems || []
                  }));
              // Save to persistent cache (committed to repo) for examples
              saveCachedResult(file.filename, cacheData, true);
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:485',message:'Cache save attempt',data:{filename:file.filename,isExample:isExample,resultCount:fileResults.length,usePersistent:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
            }
          }
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:468',message:'File processing success',data:{filename:file.filename,receiptCount:jsonReceipts.length,lineItemCount:lineItems.length,resultAdded:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
        }
        
      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'extract-receipts.js:490',message:'File processing error',data:{filename:file.filename,errorType:error?.constructor?.name,errorMessage:error?.message||String(error),stack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
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