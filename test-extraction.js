// Test script to debug receipt extraction
// Run with: node test-extraction.js <path-to-image>

const fs = require('fs');
const path = require('path');

async function testExtraction(imagePath) {
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable not set');
    process.exit(1);
  }

  const prompt = `SYSTEM: You are a deterministic receipt extraction and policy classification engine for enterprise expense management. Extract fields, classify fraud and policy risks, then return a single JSON array of receipt objects. Be conservative when flagging. Provide evidence for every non-empty flag. Return JSON only, no extra text.

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

receipt_id: string, generate as "test-${Date.now()}"

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

Set value true when combined confidence >= 0.6 with evidence. Otherwise false, but include any evidence found

Visual or metadata anomalies: no-exif, screenshot-metadata, generator-tag, layered-artifacts, cloned-patches, vector-font-pattern, uniform-kerning

Content anomalies: impossible-invoice-format, invalid-tax-id, currency-mismatch, impossible-total, merchant-not-found, domain-mismatch:merchant/domain, phone-format-invalid

Consistency anomalies: mismatch-total-lines, duplicated-line-items, subtotal-tax-mismatch without a valid discount or service line

Behavioral indicators in a single file or batch: repeated-layout-pattern, multiple-receipts-perfectly-uniform

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

If suspicious_fraud_risk.value true and confidence >= 0.75, notes = "Hold for manual review, potential AI generated receipt"

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

For alcohol detection: recognize spirit names (vodka, gin, rum, whiskey, tequila, etc.) in line items even if merchant name doesn't indicate alcohol. Use semantic understanding - if line items contain alcohol product names, flag as Alcohol category.`;

  console.log('🔄 Calling Gemini API...');
  console.log(`📸 Image: ${imagePath} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
  console.log(`🔑 API Key: ${GEMINI_API_KEY.substring(0, 10)}...`);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 4096,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, errorText);
      process.exit(1);
    }

    const data = await response.json();
    const fullContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('\n📄 Raw Response:');
    console.log('='.repeat(80));
    console.log(fullContent);
    console.log('='.repeat(80));

    // Parse JSON response
    let jsonReceipts = [];
    
    try {
      let cleanContent = fullContent.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      const parsed = JSON.parse(cleanContent);
      jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
      
      console.log(`\n✅ Parsed ${jsonReceipts.length} receipt(s) from JSON`);
      
      if (jsonReceipts.length === 0) {
        console.error('\n❌ ERROR: Empty array returned! This violates the prompt requirement.');
        console.log('\n🔍 Debugging:');
        console.log('- Full content length:', fullContent.length);
        console.log('- Clean content length:', cleanContent.length);
        console.log('- First 200 chars:', fullContent.substring(0, 200));
      } else {
        console.log('\n📋 Receipt Data:');
        console.log(JSON.stringify(jsonReceipts, null, 2));
        
        // Check for alcohol flags
        jsonReceipts.forEach((receipt, idx) => {
          const hasAlcohol = receipt.flags?.unauthorized_category?.value === true && 
            receipt.flags?.unauthorized_category?.categories?.includes('Alcohol');
          
          console.log(`\n🍷 Receipt ${idx + 1} Alcohol Detection:`);
          console.log(`  - Flagged: ${hasAlcohol ? 'YES ✅' : 'NO ❌'}`);
          if (receipt.flags?.unauthorized_category) {
            console.log(`  - Categories: ${receipt.flags.unauthorized_category.categories?.join(', ') || 'none'}`);
            console.log(`  - Evidence: ${receipt.flags.unauthorized_category.evidence?.join(', ') || 'none'}`);
            console.log(`  - Confidence: ${receipt.flags.unauthorized_category.confidence || 0}`);
          }
          
          if (receipt.line_items && receipt.line_items.length > 0) {
            console.log(`  - Line items: ${receipt.line_items.length}`);
            receipt.line_items.forEach(item => {
              console.log(`    • ${item.description}: $${item.amount} (${item.category || 'no category'})`);
            });
          }
        });
      }
      
    } catch (parseError) {
      console.error('\n❌ JSON Parse Error:', parseError.message);
      console.log('\n🔍 Attempting to extract JSON from text...');
      
      const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          jsonReceipts = Array.isArray(parsed) ? parsed : [parsed];
          console.log(`✅ Extracted JSON from text: ${jsonReceipts.length} receipt(s)`);
          console.log(JSON.stringify(jsonReceipts, null, 2));
        } catch (e) {
          console.error('❌ Failed to extract JSON:', e.message);
        }
      } else {
        console.error('❌ No JSON array found in response');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get image path from command line
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node test-extraction.js <path-to-image>');
  console.error('Example: node test-extraction.js ./test-receipt.png');
  process.exit(1);
}

testExtraction(imagePath).catch(console.error);

