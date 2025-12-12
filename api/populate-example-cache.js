#!/usr/bin/env node
/**
 * Script to populate example receipt cache
 * 
 * This script processes all example receipts and saves the results to
 * api/example-cache/ directory, which is committed to the repo.
 * 
 * Usage:
 *   GEMINI_API_KEY=your_key node api/populate-example-cache.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is required');
  console.error('Usage: GEMINI_API_KEY=your_key node api/populate-example-cache.js');
  process.exit(1);
}

const EXAMPLE_FILES = [
  'fake-receipt.png',
  'restaurant-receipt.jpeg',
  'alcohol example.png',
  'software.png',
  'hotel-receipt copy.png',
  'grocery-receipt.jpeg',
  'google ads.png',
  'transport-receipt.png'
];

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'sample-receipts');
const CACHE_DIR = path.join(__dirname, 'example-cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`✅ Created cache directory: ${CACHE_DIR}`);
}

// Simple base64 encoding
function encodeBase64(buffer) {
  return Buffer.from(buffer, 'binary').toString('base64');
}

// Generate cache key from filename
function getCacheKey(filename) {
  const normalized = filename.toLowerCase().replace(/\s+/g, '-');
  return `example-${normalized}`;
}

// Process a single example file
async function processExample(filename) {
  const filePath = path.join(PUBLIC_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return null;
  }
  
  console.log(`\n📄 Processing: ${filename}`);
  
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = encodeBase64(fileBuffer);
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // Call Gemini API
    console.log(`  🔄 Calling Gemini API...`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
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
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Gemini API error: ${response.status} ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    const fullContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse JSON response
    let jsonReceipts = [];
    try {
      let cleanContent = fullContent.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      console.error(`  ❌ Failed to parse JSON: ${parseError.message}`);
      console.error(`  Response preview: ${fullContent.substring(0, 200)}`);
      return null;
    }
    
    if (jsonReceipts.length === 0) {
      console.error(`  ❌ No receipts extracted`);
      return null;
    }
    
    console.log(`  ✅ Extracted ${jsonReceipts.length} receipt(s)`);
    
    // Convert to CSV format (simplified - using the same logic as extract-receipts.js)
    // For now, we'll store the raw JSON and convert on the fly
    // Actually, let's store it in the same format as the cache expects
    const csvRows = [];
    const lineItems = [];
    
    for (const receipt of jsonReceipts) {
      // Map fraud risk
      let fraudRisk = 'Low';
      if (receipt.flags?.suspicious_fraud_risk?.value === true) {
        const conf = receipt.flags.suspicious_fraud_risk.confidence || 0;
        if (conf >= 0.75) fraudRisk = 'High';
        else if (conf >= 0.6) fraudRisk = 'Medium';
      }
      
      const duplicate = receipt.flags?.duplicate?.value === true ? 'Yes' : 'No';
      const alcoholTobacco = receipt.flags?.unauthorized_category?.value === true && 
        receipt.flags?.unauthorized_category?.categories?.some(cat => 
          cat === 'Alcohol' || cat === 'Tobacco'
        ) ? 'Yes' : 'No';
      const personalExpense = receipt.flags?.suspicious_personal?.value === true ? 
        'Suspicious Personal' : 'No';
      
      const csvRow = [
        receipt.invoice_number || '',
        receipt.date || '',
        receipt.amount !== undefined ? String(receipt.amount) : '',
        receipt.currency || '',
        receipt.merchant || '',
        receipt.transaction_type || 'Other',
        fraudRisk,
        duplicate,
        alcoholTobacco,
        personalExpense,
        receipt.notes || ''
      ].join(',');
      
      csvRows.push(csvRow);
      
      // Extract line items
      if (receipt.line_items && Array.isArray(receipt.line_items)) {
        for (const item of receipt.line_items) {
          lineItems.push({
            invoiceNumber: receipt.invoice_number || '',
            description: item.description || '',
            date: item.date || receipt.date || '',
            amount: item.amount !== undefined ? String(item.amount) : '',
            category: item.category || ''
          });
        }
      }
    }
    
    // Save to cache
    const cacheKey = getCacheKey(filename);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    
    // Cache format: single object if one receipt, array if multiple
    // Each entry has csv (single row) and lineItems (for that receipt)
    const cacheData = jsonReceipts.length === 1 
      ? {
          csv: csvRows[0],
          lineItems: lineItems.filter(li => {
            // Match line items to this receipt by invoice number
            const receipt = jsonReceipts[0];
            return !receipt.invoice_number || li.invoiceNumber === receipt.invoice_number;
          })
        }
      : jsonReceipts.map((receipt, idx) => ({
          csv: csvRows[idx],
          lineItems: lineItems.filter(li => {
            // Match line items to this receipt by invoice number
            return !receipt.invoice_number || li.invoiceNumber === receipt.invoice_number;
          })
        }));
    
    const cacheEntry = {
      timestamp: Date.now(),
      filename,
      data: cacheData
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2));
    console.log(`  💾 Saved cache: ${cachePath}`);
    
    return cacheEntry;
  } catch (error) {
    console.error(`  ❌ Error processing ${filename}:`, error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting example cache population...');
  console.log(`📁 Cache directory: ${CACHE_DIR}`);
  console.log(`📁 Public directory: ${PUBLIC_DIR}`);
  console.log(`📋 Processing ${EXAMPLE_FILES.length} example files\n`);
  
  const results = [];
  for (const filename of EXAMPLE_FILES) {
    const result = await processExample(filename);
    if (result) {
      results.push({ filename, success: true });
    } else {
      results.push({ filename, success: false });
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  
  if (successful > 0) {
    console.log(`\n✅ Cache files saved to: ${CACHE_DIR}`);
    console.log('💡 Commit these files to git so they persist in Vercel deployments');
  }
  
  if (failed > 0) {
    console.log('\n⚠️  Some files failed. Check the errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

