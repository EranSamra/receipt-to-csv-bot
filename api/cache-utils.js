import fs from 'fs';
import path from 'path';

const CACHE_DIR = '/tmp/receipt-cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Ensure cache directory exists
function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (error) {
    console.warn('[Cache] Failed to create cache directory:', error.message);
  }
}

// Generate cache key from filename
function getCacheKey(filename) {
  // Normalize filename (remove spaces, lowercase)
  const normalized = filename.toLowerCase().replace(/\s+/g, '-');
  return `example-${normalized}`;
}

// Check if file is an example receipt
export function isExampleReceipt(filename) {
  const exampleFiles = [
    'fake-receipt.png',
    'restaurant-receipt.jpeg',
    'alcohol example.png',
    'software.png',
    'hotel-receipt copy.png',
    'grocery-receipt.jpeg',
    'amazon.png',
    'google ads.png',
    'transport-receipt.png'
  ];
  
  // Normalize both filename and example names the same way for comparison
  // This handles spaces, dashes, and case differences
  // Also extract just the filename if a path is provided
  const normalize = (str) => {
    // Extract just the filename from path if present
    const basename = str.includes('/') ? str.split('/').pop() : str;
    return basename.toLowerCase().replace(/\s+/g, '-');
  };
  const normalizedFilename = normalize(filename);
  
  const isMatch = exampleFiles.some(example => {
    const normalizedExample = normalize(example);
    // Check if normalized versions match (handles spaces/dashes)
    const matches = normalizedFilename === normalizedExample || 
           normalizedFilename.includes(normalizedExample) ||
           normalizedExample.includes(normalizedFilename);
    if (matches) {
      console.log(`[Cache] ✅ Example match: "${filename}" matches "${example}" (normalized: "${normalizedFilename}" === "${normalizedExample}")`);
    }
    return matches;
  });
  
  if (!isMatch) {
    console.log(`[Cache] ❌ Not an example: "${filename}" (normalized: "${normalizedFilename}")`);
  }
  
  return isMatch;
}

// Get cached result
export function getCachedResult(filename) {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(filename);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:47',message:'Cache get attempt',data:{filename:filename,cacheKey:cacheKey,cachePath:cachePath,cacheDir:CACHE_DIR,dirExists:fs.existsSync(CACHE_DIR),fileExists:fs.existsSync(cachePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    
    // Check if cache is expired
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      fs.unlinkSync(cachePath); // Delete expired cache
      return null;
    }
    
    console.log(`[Cache] ✅ Cache hit for ${filename}`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:65',message:'Cache hit',data:{filename:filename,hasData:!!cached.data,dataType:Array.isArray(cached.data)?'array':typeof cached.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return cached.data;
  } catch (error) {
    console.warn(`[Cache] Failed to read cache for ${filename}:`, error.message);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:68',message:'Cache get error',data:{filename:filename,error:error.message,errorType:error?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return null;
  }
}

// Save result to cache
export function saveCachedResult(filename, data) {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(filename);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:74',message:'Cache save attempt',data:{filename:filename,cachePath:cachePath,dirExists:fs.existsSync(CACHE_DIR),dataType:Array.isArray(data)?'array':typeof data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const cacheEntry = {
      timestamp: Date.now(),
      filename,
      data
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2));
    console.log(`[Cache] 💾 Cached result for ${filename}`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:87',message:'Cache save success',data:{filename:filename,fileWritten:fs.existsSync(cachePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    console.warn(`[Cache] Failed to save cache for ${filename}:`, error.message);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:89',message:'Cache save error',data:{filename:filename,error:error.message,errorType:error?.constructor?.name,code:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }
}

// Simulate processing delay (2-4 seconds for examples)
export function simulateProcessingDelay() {
  const delay = 2000 + Math.random() * 2000; // 2-4 seconds
  console.log(`[Cache] Simulating ${Math.round(delay)}ms processing delay...`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

