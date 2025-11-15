/**
 * Convert PDF file to image (PNG/JPEG)
 * Uses pdfjs-dist to render PDF pages to canvas, then converts to image
 */
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs-dist
// IMPORTANT: This must be set BEFORE any PDF.js operations
if (typeof window !== 'undefined') {
  // Use local worker file (copied to public folder) for reliability
  // Try both .js and .mjs extensions to ensure compatibility
  const workerPathJS = '/pdf.worker.min.js';
  const workerPathMJS = '/pdf.worker.min.mjs';
  
  // Use .js extension first (PDF.js might expect this)
  const workerPath = workerPathJS;
  const workerUrl = `${window.location.origin}${workerPath}`;
  
  // Set worker source immediately - use relative path (PDF.js handles it better)
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
  
  console.log(`[PDFConverter] PDF.js worker configured:`);
  console.log(`  - Path: ${workerPath}`);
  console.log(`  - Full URL: ${workerUrl}`);
  console.log(`  - Version: ${pdfjsLib.version}`);
  console.log(`  - WorkerSrc value: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
  
  // Verify worker file exists (async, won't block)
  Promise.all([
    fetch(workerPathJS, { method: 'HEAD' }).catch(() => null),
    fetch(workerPathMJS, { method: 'HEAD' }).catch(() => null)
  ]).then(([jsResponse, mjsResponse]) => {
    if (jsResponse?.ok) {
      console.log(`[PDFConverter] ✅ Worker file (.js) is accessible at ${workerPathJS}`);
    } else if (mjsResponse?.ok) {
      console.log(`[PDFConverter] ✅ Worker file (.mjs) is accessible at ${workerPathMJS}`);
      // If only .mjs exists, update the path
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPathMJS;
      console.log(`[PDFConverter] Updated worker source to use .mjs extension`);
    } else {
      console.error(`[PDFConverter] ❌ Neither worker file is accessible`);
      console.error(`[PDFConverter] Checked: ${workerPathJS} and ${workerPathMJS}`);
    }
  }).catch(err => {
    console.error(`[PDFConverter] ❌ Worker file check failed:`, err);
  });
}

/**
 * Convert PDF file to image file
 * @param pdfFile - PDF File object
 * @param format - Output image format ('image/png' or 'image/jpeg')
 * @param quality - JPEG quality (0-1, only for JPEG format)
 * @returns Promise<File> - Converted image file
 */
export async function convertPDFToImage(
  pdfFile: File,
  format: 'image/png' | 'image/jpeg' = 'image/jpeg',
  quality: number = 0.9
): Promise<File> {
  const startTime = performance.now();
  
  try {
    console.log(`[PDFConverter] Starting conversion: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(1)}KB) to ${format}...`);

    // Read PDF file as array buffer
    const arrayBuffer = await pdfFile.arrayBuffer();
    console.log(`[PDFConverter] PDF loaded into memory: ${(arrayBuffer.byteLength / 1024).toFixed(1)}KB`);
    
    // Verify worker is configured
    const currentWorkerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc;
    if (!currentWorkerSrc) {
      throw new Error('PDF.js worker not configured. Please check your internet connection.');
    }
    
    // Log worker source to debug
    console.log(`[PDFConverter] Using worker source: ${currentWorkerSrc}`);
    
    // Ensure worker source doesn't point to CDN (should be local)
    if (currentWorkerSrc.includes('cdnjs.cloudflare.com')) {
      console.error(`[PDFConverter] ❌ ERROR: Worker source still points to CDN: ${currentWorkerSrc}`);
      console.error(`[PDFConverter] This should be a local path. Re-setting worker source...`);
      // Try .js first, then .mjs
      const localWorkerPathJS = '/pdf.worker.min.js';
      const localWorkerPathMJS = '/pdf.worker.min.mjs';
      pdfjsLib.GlobalWorkerOptions.workerSrc = localWorkerPathJS;
      console.log(`[PDFConverter] Worker source re-set to: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
    }
    
    // Load PDF document with error handling
    console.log(`[PDFConverter] Loading PDF document...`);
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      verbosity: 0 // Reduce console noise
    });
    
    const pdf = await loadingTask.promise;
    
    console.log(`[PDFConverter] PDF loaded: ${pdf.numPages} page(s)`);
    
    // Get first page (most receipts are single page)
    const page = await pdf.getPage(1);
    
    // Set scale for rendering (reduced to 1.5x to avoid huge files)
    // Higher scale = better quality but much larger file size
    const scale = 1.5; // 1.5x scale for good balance of quality and file size
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    
    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    console.log(`[PDFConverter] PDF rendered to canvas: ${canvas.width}x${canvas.height}`);
    
    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'));
            return;
          }
          
          // Create new File object with converted image
          const fileName = pdfFile.name.replace(/\.pdf$/i, format === 'image/jpeg' ? '.jpg' : '.png');
          const imageFile = new File(
            [blob],
            fileName,
            {
              type: format,
              lastModified: pdfFile.lastModified
            }
          );
          
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
          console.log(`[PDFConverter] ✅ Conversion successful in ${elapsed}s: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(1)}KB) -> ${fileName} (${(imageFile.size / 1024).toFixed(1)}KB)`);
          console.log(`[PDFConverter] Converted file type: ${imageFile.type}, size: ${imageFile.size} bytes`);
          resolve(imageFile);
        },
        format,
        quality
      );
    });
  } catch (error) {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.error(`[PDFConverter] ❌ Conversion failed after ${elapsed}s for ${pdfFile.name}:`, error);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error(`[PDFConverter] Error message: ${error.message}`);
      console.error(`[PDFConverter] Error stack: ${error.stack}`);
    }
    
    // Check for common issues
    if (error && typeof error === 'object' && 'name' in error) {
      if (error.name === 'InvalidPDFException') {
        throw new Error('Invalid PDF file. The file may be corrupted or not a valid PDF.');
      } else if (error.name === 'MissingPDFException') {
        throw new Error('PDF file is missing or could not be loaded.');
      } else if (error.name === 'UnexpectedResponseException') {
        throw new Error('PDF.js worker failed to load. Please check your internet connection.');
      }
    }
    
    throw error;
  }
}

