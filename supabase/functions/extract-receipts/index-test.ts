// Minimal test function to identify the exact error
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Step 1: Test basic function
    console.log('=== FUNCTION STARTED ===');
    
    // Step 2: Test form data parsing
    const formData = await req.formData();
    console.log('Form data parsed successfully');
    
    const file = formData.get('files') as File;
    console.log('File extracted:', file ? `Name: ${file.name}, Size: ${file.size}` : 'No file');
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided', step: 'file_check' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Test API key
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    console.log('API key check:', GEMINI_API_KEY ? 'EXISTS' : 'MISSING');
    
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured', step: 'api_key_check' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Test file processing
    console.log('Starting file processing...');
    const bytes = await file.arrayBuffer();
    console.log('File converted to bytes:', bytes.byteLength);
    
    // Step 5: Test base64 encoding
    const uint8Array = new Uint8Array(bytes);
    let base64 = '';
    for (let i = 0; i < Math.min(uint8Array.length, 1000); i++) { // Only first 1000 bytes for test
      base64 += String.fromCharCode(uint8Array[i]);
    }
    base64 = btoa(base64);
    console.log('Base64 encoding successful, length:', base64.length);

    // Step 6: Test Gemini API call
    console.log('Testing Gemini API call...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Say 'API working' if you can read this" }]
        }]
      })
    });

    console.log('Gemini API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: `Gemini API failed: ${response.status}`, 
          details: errorText,
          step: 'gemini_api_call'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Gemini API response received');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All tests passed',
        geminiResponse: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response',
        step: 'complete'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== FUNCTION ERROR ===', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        step: 'catch_block'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
