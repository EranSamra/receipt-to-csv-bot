#!/usr/bin/env node
/**
 * Test script to verify Gemini API key is working
 * Usage: GEMINI_API_KEY=your_key node test-gemini-key.js
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is required');
  console.error('Usage: GEMINI_API_KEY=your_key node test-gemini-key.js');
  process.exit(1);
}

console.log('🔑 Testing Gemini API key...');
console.log(`Key prefix: ${GEMINI_API_KEY.substring(0, 10)}...`);
console.log(`Key length: ${GEMINI_API_KEY.length} characters\n`);

async function testGeminiKey() {
  try {
    console.log('📡 Making test API call...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Say "Hello, API key is working!" if you can read this.'
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50,
          }
        })
      }
    );
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ API Error:');
      try {
        const errorJson = JSON.parse(errorText);
        console.error(JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error(errorText);
      }
      process.exit(1);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    
    console.log('\n✅ API Key is working!');
    console.log(`Response: ${content}\n`);
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error testing API key:');
    console.error(error.message);
    process.exit(1);
  }
}

testGeminiKey();

