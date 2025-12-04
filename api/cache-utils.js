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
  
  const normalized = filename.toLowerCase();
  return exampleFiles.some(example => {
    const normalizedExample = example.toLowerCase().replace(/\s+/g, '-');
    return normalized.includes(normalizedExample) || normalized === normalizedExample;
  });
}

// Get cached result
export function getCachedResult(filename) {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(filename);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    
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
    return cached.data;
  } catch (error) {
    console.warn(`[Cache] Failed to read cache for ${filename}:`, error.message);
    return null;
  }
}

// Save result to cache
export function saveCachedResult(filename, data) {
  try {
    ensureCacheDir();
    const cacheKey = getCacheKey(filename);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    
    const cacheEntry = {
      timestamp: Date.now(),
      filename,
      data
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheEntry, null, 2));
    console.log(`[Cache] 💾 Cached result for ${filename}`);
  } catch (error) {
    console.warn(`[Cache] Failed to save cache for ${filename}:`, error.message);
  }
}

// Simulate processing delay (2-4 seconds for examples)
export function simulateProcessingDelay() {
  const delay = 2000 + Math.random() * 2000; // 2-4 seconds
  console.log(`[Cache] Simulating ${Math.round(delay)}ms processing delay...`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

