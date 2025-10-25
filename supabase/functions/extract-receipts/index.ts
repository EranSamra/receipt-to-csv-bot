import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `You are a precise information extraction engine that converts receipt images into clean, validated CSV rows for expense reports. Your job is to return only a CSV payload that follows the exact schema and rules below. If information is missing or uncertain, leave the field empty, never guess, and never invent merchants, totals, or dates.

CSV schema:
Header columns, in this exact order:
source_filename,merchant_name,merchant_tax_id,merchant_address,merchant_city,merchant_country,receipt_datetime_local,currency,subtotal_amount,tax_amount,tip_amount,total_amount,payment_method,last4_card,invoice_or_receipt_number,line_items_json,category_hint,notes

Field rules:
- source_filename: original file name if available, else a stable placeholder like image_001.jpg
- merchant_name: exact store or vendor name as printed
- merchant_tax_id: VAT, ABN, EIN, CIF, SIREN, etc. Normalize to raw string without spaces where feasible
- merchant_address: street + number
- merchant_city: city or locality only
- merchant_country: ISO 3166-1 alpha-2 code if visible, else empty
- receipt_datetime_local: ISO 8601 format YYYY-MM-DDThh:mm, 24h, local time if visible; if only a date appears, use YYYY-MM-DD and omit time
- currency: 3-letter ISO code inferred from symbol or text. Examples: USD, EUR, GBP, ILS. If unknown, leave empty
- subtotal_amount, tax_amount, tip_amount, total_amount: use dot as decimal separator. Only numbers. If only total is present, set subtotal empty and tax empty
- payment_method: one of [card, cash, mobile, bank_transfer, unknown]
- last4_card: last 4 digits if shown, else empty
- invoice_or_receipt_number: any document number printed
- line_items_json: JSON array string of objects [{"description":"","qty":0,"unit_price":0,"line_total":0}] with numeric fields as numbers. If no items visible, return "[]"
- category_hint: one word or short phrase if clearly inferable from merchant or items, such as travel, meals, lodging, fuel, rideshare, parking, supplies. Else empty
- notes: optional short note for anomalies or critical uncertainties. Max 120 chars

Normalization rules:
- Convert dates to ISO with correct locale if obvious from context
- Currency symbols map to ISO codes
- Remove thousands separators, keep decimal point
- Trim whitespace

Validation rules:
- If total_amount and subtotal_amount + tax_amount + tip_amount mismatch beyond 1%, keep total_amount as printed and add notes warning
- If the receipt is not a financial document, return an empty CSV row with only source_filename filled and put "Non-receipt" in notes

Multi-language:
- Preserve merchant and address text in the original script
- Dates and numbers must be normalized as per rules above

Line item guidance:
- If quantities missing, set qty to 1
- If unit_price missing but line_total present, set unit_price equal to line_total
- Exclude tips and taxes from line_items_json unless they appear as explicit line items

Return format:
Output only the CSV text. No explanations. No code fences. No markdown. Just the raw CSV with header and data row(s).`;

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

    console.log(`Processing ${files.length} receipt image(s)`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process all images in parallel
    const imagePromises = files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      return {
        name: file.name,
        base64: `data:${file.type};base64,${base64}`
      };
    });

    const images = await Promise.all(imagePromises);

    // Build content array with all images
    const content = [
      {
        type: "text",
        text: `${EXTRACTION_PROMPT}\n\nProcess these ${images.length} receipt image(s) and return a CSV with one row per image.`
      },
      ...images.map(img => ({
        type: "image_url",
        image_url: { url: img.base64 }
      }))
    ];

    console.log('Calling Lovable AI for receipt extraction');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: content
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add more credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to process receipts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const csvContent = aiData.choices?.[0]?.message?.content || '';
    
    console.log('Extraction successful');

    return new Response(
      JSON.stringify({ csv: csvContent }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in extract-receipts function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
