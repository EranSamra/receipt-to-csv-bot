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
      
      // First, let's see what filenames are actually in the database
      const { data: allData } = await supabase
        .from('example_receipt_cache')
        .select('filename')
        .limit(20);
      console.log(`[Cache] All filenames in DB (first 20):`, allData?.map(d => d.filename) || 'none');
      
      // Try multiple matching strategies
      // 1. Exact match
      let { data, error } = await supabase
        .from('example_receipt_cache')
        .select('csv_data, line_items, filename')
        .eq('filename', filename)
        .maybeSingle();
      
      console.log(`[Cache] Query 1 - Exact match "${filename}":`, { 
        hasData: !!data, 
        hasError: !!error, 
        errorCode: error?.code,
        foundFilename: data?.filename
      });
      
      // 2. Case-insensitive exact match
      if (!data && !error) {
        const { data: data2, error: error2 } = await supabase
          .from('example_receipt_cache')
          .select('csv_data, line_items, filename')
          .ilike('filename', filename)
          .maybeSingle();
        
        console.log(`[Cache] Query 2 - Case-insensitive match "${filename}":`, { 
          hasData: !!data2, 
          hasError: !!error2,
          foundFilename: data2?.filename
        });
        
        if (!error2 && data2) {
          data = data2;
          error = null;
        }
      }
      
      // 3. Normalized filename match (spaces to dashes, lowercase)
      if (!data && !error) {
        const { data: data3, error: error3 } = await supabase
          .from('example_receipt_cache')
          .select('csv_data, line_items, filename')
          .ilike('filename', `%${normalizedFilename}%`)
          .maybeSingle();
        
        console.log(`[Cache] Query 3 - Normalized match "%${normalizedFilename}%":`, { 
          hasData: !!data3, 
          hasError: !!error3,
          foundFilename: data3?.filename
        });
        
        if (!error3 && data3) {
          data = data3;
          error = null;
        }
      }
      
      // 4. Try matching just the basename (without path)
      if (!data && !error) {
        const basename = filename.includes('/') ? filename.split('/').pop() : filename;
        const { data: data4, error: error4 } = await supabase
          .from('example_receipt_cache')
          .select('csv_data, line_items, filename')
          .ilike('filename', `%${basename}%`)
          .maybeSingle();
        
        console.log(`[Cache] Query 4 - Basename match "%${basename}%":`, { 
          hasData: !!data4, 
          hasError: !!error4,
          foundFilename: data4?.filename
        });
        
        if (!error4 && data4) {
          data = data4;
          error = null;
        }
      }
      
      if (error && error.code !== 'PGRST116') {
        console.warn(`[Cache] Database query error for ${filename}:`, error.message, error.code);
      }
      
      if (data) {
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

