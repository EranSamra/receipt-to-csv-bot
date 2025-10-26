// Test function to debug the issue
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
    console.log('Function called - debugging mode');
    
    const formData = await req.formData();
    const file = formData.get('files') as File;
    
    console.log('File received:', file ? file.name : 'No file');
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File size:', file.size);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    console.log('API key exists:', !!GEMINI_API_KEY);
    
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test Gemini API call
    console.log('Testing Gemini API call...');
    
    const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Hello, respond with 'API working'" }]
        }]
      })
    });

    console.log('Gemini response status:', testResponse.status);
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${testResponse.status} - ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testData = await testResponse.json();
    console.log('Gemini response:', testData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Function working',
        geminiResponse: testData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
