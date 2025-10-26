// Test script to verify our base64 encoding approach
const testBase64 = (size) => {
  console.log(`Testing ${size} bytes...`);
  
  // Simulate file data
  const testData = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    testData[i] = i % 256;
  }
  
  try {
    // Use our chunked approach
    let base64 = '';
    const chunkSize = 512;
    for (let i = 0; i < testData.length; i += chunkSize) {
      const chunk = testData.slice(i, i + chunkSize);
      base64 += btoa(String.fromCharCode(...chunk));
    }
    
    console.log(`✅ Success: ${size} bytes encoded to ${base64.length} chars`);
    return true;
  } catch (error) {
    console.log(`❌ Failed: ${size} bytes - ${error.message}`);
    return false;
  }
};

// Test different sizes
const sizes = [1024, 10240, 102400, 500000]; // 1KB, 10KB, 100KB, 500KB

console.log('Testing base64 encoding with our new approach...\n');

sizes.forEach(size => {
  const success = testBase64(size);
  if (!success) {
    console.log(`❌ Stack overflow at ${size} bytes`);
    process.exit(1);
  }
});

console.log('\n✅ All tests passed! Our approach should work.');
