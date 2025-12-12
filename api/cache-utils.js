import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Get the directory of the current module (works in both Node.js and Vercel)
let __dirname;
try {
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // Fallback for environments where import.meta.url might not work
  __dirname = path.resolve('.');
}

// Persistent cache directory (in repo, committed to git)
const PERSISTENT_CACHE_DIR = path.join(__dirname, 'example-cache');
// Ephemeral cache directory (in /tmp, cleared between Vercel invocations)
const EPHEMERAL_CACHE_DIR = '/tmp/receipt-cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds (not used for persistent cache)

// Ensure cache directory exists (for ephemeral cache only)
function ensureCacheDir() {
  try {
    if (!fs.existsSync(EPHEMERAL_CACHE_DIR)) {
      fs.mkdirSync(EPHEMERAL_CACHE_DIR, { recursive: true });
    }
  } catch (error) {
    console.warn('[Cache] Failed to create ephemeral cache directory:', error.message);
  }
}

// Ensure persistent cache directory exists
function ensurePersistentCacheDir() {
  try {
    if (!fs.existsSync(PERSISTENT_CACHE_DIR)) {
      fs.mkdirSync(PERSISTENT_CACHE_DIR, { recursive: true });
    }
  } catch (error) {
    console.warn('[Cache] Failed to create persistent cache directory:', error.message);
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

// Initialize Supabase client for database queries
function getSupabaseClient() {
  // In Vercel serverless functions, use non-VITE_ prefixed vars
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Prefer service role key for admin access, fallback to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.log(`[Cache] Supabase not initialized - URL: ${!!supabaseUrl}, Key: ${!!supabaseKey}`);
    return null;
  }
  
  console.log(`[Cache] Supabase client initialized with URL: ${supabaseUrl.substring(0, 20)}...`);
  return createClient(supabaseUrl, supabaseKey);
}

// Get cached result - checks database first, then persistent cache, then ephemeral cache
export async function getCachedResult(filename) {
  console.log(`[Cache] Looking up cache for: ${filename}`);
  
  // First, try database (Supabase) for example results
  const supabase = getSupabaseClient();
  if (supabase) {
    console.log(`[Cache] Supabase client initialized, querying database...`);
    try {
      // Normalize filename for database lookup
      const normalize = (str) => {
        const basename = str.includes('/') ? str.split('/').pop() : str;
        return basename.toLowerCase().replace(/\s+/g, '-');
      };
      const normalizedFilename = normalize(filename);
      console.log(`[Cache] Normalized filename: "${normalizedFilename}" (original: "${filename}")`);
      
      // First, let's try to see what filenames are in the database (for debugging)
      const { data: allData } = await supabase
        .from('example_receipt_cache')
        .select('filename')
        .limit(10);
      console.log(`[Cache] Sample filenames in DB:`, allData?.map(d => d.filename) || 'none');
      
      // Query database for example results from 'example_receipt_cache' table
      const { data, error } = await supabase
        .from('example_receipt_cache')
        .select('csv_data, line_items, filename')
        .eq('filename', filename)
        .maybeSingle();
      
      console.log(`[Cache] Database query result for exact match:`, { 
        hasData: !!data, 
        hasError: !!error, 
        errorCode: error?.code, 
        errorMessage: error?.message 
      });
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - try with normalized filename
          console.log(`[Cache] No exact match, trying normalized filename...`);
          const { data: data2, error: error2 } = await supabase
            .from('example_receipt_cache')
            .select('csv_data, line_items')
            .ilike('filename', `%${normalizedFilename}%`)
            .maybeSingle();
          
          console.log(`[Cache] Database query result for normalized match:`, { 
            hasData: !!data2, 
            hasError: !!error2, 
            errorCode: error2?.code 
          });
          
          if (!error2 && data2) {
            console.log(`[Cache] ✅ Database result found for ${filename} (normalized match)`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:128',message:'Database example result (normalized)',data:{filename:filename,hasData:!!data2,hasCsv:!!data2.csv_data,hasLineItems:!!data2.line_items},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            
            return {
              csv: data2.csv_data || '',
              lineItems: Array.isArray(data2.line_items) ? data2.line_items : (data2.line_items || [])
            };
          } else {
            console.log(`[Cache] No database result found (normalized match also failed)`);
          }
        } else {
          console.warn(`[Cache] Database query error for ${filename}:`, error.message, error.code);
        }
      } else if (data) {
        console.log(`[Cache] ✅ Database result found for ${filename}`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:140',message:'Database example result',data:{filename:filename,hasData:!!data,hasCsv:!!data.csv_data,hasLineItems:!!data.line_items},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Return in the format expected by extract-receipts.js
        return {
          csv: data.csv_data || '',
          lineItems: Array.isArray(data.line_items) ? data.line_items : (data.line_items || [])
        };
      } else {
        console.log(`[Cache] No database result found (no data, no error)`);
      }
    } catch (error) {
      console.warn(`[Cache] Database query failed for ${filename}:`, error.message);
    }
  } else {
    console.log(`[Cache] Supabase client not initialized (missing env vars)`);
  }
  
  console.log(`[Cache] Falling back to file cache for ${filename}...`);
  
  const cacheKey = getCacheKey(filename);
  
  // Second, try persistent cache (in repo)
  try {
    const persistentCachePath = path.join(PERSISTENT_CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(persistentCachePath)) {
      const cached = JSON.parse(fs.readFileSync(persistentCachePath, 'utf8'));
      console.log(`[Cache] ✅ Persistent cache hit for ${filename}`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:108',message:'Persistent cache hit',data:{filename:filename,hasData:!!cached.data,dataType:Array.isArray(cached.data)?'array':typeof cached.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return cached.data;
    }
  } catch (error) {
    console.warn(`[Cache] Failed to read persistent cache for ${filename}:`, error.message);
  }
  
  // Fallback to ephemeral cache (in /tmp)
  try {
    ensureCacheDir();
    const ephemeralCachePath = path.join(EPHEMERAL_CACHE_DIR, `${cacheKey}.json`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:95',message:'Checking ephemeral cache',data:{filename:filename,cacheKey:cacheKey,cachePath:ephemeralCachePath,dirExists:fs.existsSync(EPHEMERAL_CACHE_DIR),fileExists:fs.existsSync(ephemeralCachePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!fs.existsSync(ephemeralCachePath)) {
      return null;
    }
    
    const cached = JSON.parse(fs.readFileSync(ephemeralCachePath, 'utf8'));
    
    // Check if cache is expired (only for ephemeral cache)
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      fs.unlinkSync(ephemeralCachePath); // Delete expired cache
      return null;
    }
    
    console.log(`[Cache] ✅ Ephemeral cache hit for ${filename}`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:108',message:'Ephemeral cache hit',data:{filename:filename,hasData:!!cached.data,dataType:Array.isArray(cached.data)?'array':typeof cached.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return cached.data;
  } catch (error) {
    console.warn(`[Cache] Failed to read ephemeral cache for ${filename}:`, error.message);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:112',message:'Cache get error',data:{filename:filename,error:error.message,errorType:error?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return null;
  }
}

// Save result to cache (saves to persistent cache for examples, ephemeral for others)
export function saveCachedResult(filename, data, usePersistent = false) {
  const cacheKey = getCacheKey(filename);
  const cacheEntry = {
    timestamp: Date.now(),
    filename,
    data
  };
  
  // Save to persistent cache if requested (for examples)
  if (usePersistent) {
    try {
      ensurePersistentCacheDir();
      const persistentCachePath = path.join(PERSISTENT_CACHE_DIR, `${cacheKey}.json`);
      fs.writeFileSync(persistentCachePath, JSON.stringify(cacheEntry, null, 2));
      console.log(`[Cache] 💾 Saved to persistent cache for ${filename}`);
      return;
    } catch (error) {
      console.warn(`[Cache] Failed to save to persistent cache for ${filename}:`, error.message);
      // Fall through to ephemeral cache
    }
  }
  
  // Save to ephemeral cache (default)
  try {
    ensureCacheDir();
    const ephemeralCachePath = path.join(EPHEMERAL_CACHE_DIR, `${cacheKey}.json`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:140',message:'Cache save attempt',data:{filename:filename,cachePath:ephemeralCachePath,dirExists:fs.existsSync(EPHEMERAL_CACHE_DIR),dataType:Array.isArray(data)?'array':typeof data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    fs.writeFileSync(ephemeralCachePath, JSON.stringify(cacheEntry, null, 2));
    console.log(`[Cache] 💾 Cached result for ${filename}`);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:147',message:'Cache save success',data:{filename:filename,fileWritten:fs.existsSync(ephemeralCachePath)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (error) {
    console.warn(`[Cache] Failed to save cache for ${filename}:`, error.message);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/5f70a413-60bf-4dbe-858f-62736ac1b161',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cache-utils.js:150',message:'Cache save error',data:{filename:filename,error:error.message,errorType:error?.constructor?.name,code:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }
}

// Simulate processing delay (2-4 seconds for examples)
export function simulateProcessingDelay() {
  const delay = 2000 + Math.random() * 2000; // 2-4 seconds
  console.log(`[Cache] Simulating ${Math.round(delay)}ms processing delay...`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

