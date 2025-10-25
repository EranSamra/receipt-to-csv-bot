import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const currentYear = new Date().getFullYear();

const EXTRACTION_PROMPT = `Extract data from each receipt with the following field names:

CSV Header (exact order):
source_filename,is_receipt,total_amount,vat_amount,currency_ISO_4217,merchant_name_localized,date_ISO_8601,is_month_explicit,receipt_id,merchant_address,document_language_ISO_639,all_totals,all_dates,spend_category

Field rules:
- source_filename: original file name if available
- is_receipt: boolean (true/false) - true if the image is a receipt or invoice, false otherwise
- total_amount: numeric value with dot as decimal separator
- vat_amount: numeric value with dot as decimal separator, empty if not shown
- currency_ISO_4217: ISO 4217 currency code (USD, EUR, GBP, ILS, etc.). If multiple currencies appear, use the one next to total_amount
- merchant_name_localized: merchant name in original script/language
- date_ISO_8601: ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDThh:mm). If date has no year, assume ${currentYear}. Leave empty if no date
- is_month_explicit: boolean (true/false) - true if date includes textual month (e.g., "March", "Mar"), false if fully numeric (e.g., "03/05/2025")
- receipt_id: any receipt/invoice number shown
- merchant_address: full address as shown
- document_language_ISO_639: ISO 639 language code (en, he, fr, es, etc.)
- all_totals: JSON array of all total amounts found as strings, e.g., ["15.50","17.25"]
- all_dates: JSON array of all ISO 8601 dates found, e.g., ["2025-03-15","2025-03-16"]. If date has no year, assume ${currentYear}
- spend_category: one of [meals, transportation, lodging, fuel, supplies, entertainment, utilities, other]

Return format:
Output only the CSV text with header and one row per image. No markdown, no code fences, no explanations.`;

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

    // Process all images in parallel - use chunk-based base64 encoding to avoid stack overflow
    const imagePromises = files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const uint8Array = new Uint8Array(bytes);
      
      // Convert to base64 in chunks to avoid stack overflow
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      
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
