// Alternative approach: Process files one at a time with separate API calls
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const currentYear = new Date().getFullYear();
const spendCategoriesNames = "meals, transportation, lodging, fuel, supplies, entertainment, utilities, other";

const EXTRACTION_PROMPT = `Extract data from this receipt/invoice with the following field names. Handle receipts in any language (Hebrew, English, etc.) and any format (retail receipts, hotel invoices, digital receipts, etc.):

- is_receipt (boolean - true if this is a receipt or invoice, false otherwise)
- total_amount (numeric value with dot as decimal separator)
- vat_amount (numeric value with dot as decimal separator, empty if not shown)
- currency_ISO_4217 (ISO 4217 currency code: USD, EUR, GBP, ILS, etc.)
- merchant_name_localized (merchant name in original language/script)
- date_ISO_8601 (ISO 8601 format YYYY-MM-DD or YYYY-MM-DDThh:mm, assume year ${currentYear} if not specified)
- is_month_explicit (true if date includes textual month like "March", false if fully numeric)
- receipt_id (receipt/invoice number)
- merchant_address (full address as shown)
- document_language_ISO_639 (ISO 639 language code: en, he, fr, es, etc.)
- all_totals (JSON array of all total amounts found as strings)
- all_dates (JSON array of all ISO 8601 dates found)
- spend_category (one of: ${spendCategoriesNames})

CSV Header (exact order):
source_filename,is_receipt,total_amount,vat_amount,currency_ISO_4217,merchant_name_localized,date_ISO_8601,is_month_explicit,receipt_id,merchant_address,document_language_ISO_639,all_totals,all_dates,spend_category

Field rules:
- source_filename: original file name
- is_receipt: boolean (true/false)
- total_amount: numeric with dot as decimal separator
- vat_amount: numeric with dot as decimal separator, empty if not shown
- currency_ISO_4217: ISO 4217 code (USD, EUR, GBP, ILS, etc.)
- merchant_name_localized: merchant name in original script/language
- date_ISO_8601: ISO 8601 format, assume ${currentYear} if no year
- is_month_explicit: boolean (true if textual month, false if numeric)
- receipt_id: receipt/invoice number
- merchant_address: full address
- document_language_ISO_639: ISO 639 language code
- all_totals: JSON array of totals as strings, e.g., ["15.50","17.25"]
- all_dates: JSON array of ISO 8601 dates, e.g., ["2025-03-15","2025-03-16"]
- spend_category: one of [${spendCategoriesNames}]

Special instructions:
- For Hebrew receipts: extract Hebrew text as-is for merchant_name_localized
- For hotel invoices: use "lodging" as spend_category
- For digital receipts: extract all available information
- For retail receipts: determine appropriate spend_category based on items
- Handle different date formats (DD/MM/YYYY, MM/DD/YYYY, etc.)
- Extract VAT amounts even if shown as percentages

Return format:
Output only the CSV text with header and one row. No markdown, no code fences, no explanations.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 2 files to prevent memory issues
    if (files.length > 2) {
      return new Response(
        JSON.stringify({ error: 'Too many files. Maximum 2 files allowed per request.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${files.length} receipt image(s)`);

    // Process files one at a time to avoid memory issues
    const results = [];
    
    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);
        
        // Check file size limit (500KB max to prevent memory issues)
        if (file.size > 500 * 1024) {
          console.error(`File ${file.name} is too large: ${file.size} bytes`);
          results.push({
            filename: file.name,
            error: `File too large. Maximum size is 500KB.`
          });
          continue;
        }
        
        // Convert to base64 using a very simple approach
        const bytes = await file.arrayBuffer();
        const uint8Array = new Uint8Array(bytes);
        
        // Use a more memory-efficient approach
        let base64 = '';
        const chunkSize = 512; // Very small chunks
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64 += btoa(String.fromCharCode(...chunk));
        }
        
        console.log(`Successfully encoded ${file.name}`);
        
        // Call Gemini API for this single file
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `${EXTRACTION_PROMPT}\n\nProcess this receipt image and return a CSV with one row.` },
                { inline_data: { mime_type: file.type, data: base64 } }
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
          console.error('AI API error:', response.status, errorText);
          results.push({
            filename: file.name,
            error: 'Failed to process with AI'
          });
          continue;
        }

        const data = await response.json();
        const csvContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Extract just the data row (skip header if present)
        const lines = csvContent.trim().split('\n');
        const dataRow = lines.length > 1 ? lines[1] : lines[0];
        
        results.push({
          filename: file.name,
          csv: dataRow
        });
        
        console.log(`Successfully processed ${file.name}`);
        
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        results.push({
          filename: file.name,
          error: error.message
        });
      }
    }
    
    // Combine all results into a single CSV
    const csvHeader = "source_filename,is_receipt,total_amount,vat_amount,currency_ISO_4217,merchant_name_localized,date_ISO_8601,is_month_explicit,receipt_id,merchant_address,document_language_ISO_639,all_totals,all_dates,spend_category";
    const csvRows = results.map(r => r.csv || `${r.filename},false,,,,,,,,,,,other`);
    const finalCsv = [csvHeader, ...csvRows].join('\n');

    return new Response(
      JSON.stringify({ csv: finalCsv }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-receipts function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
