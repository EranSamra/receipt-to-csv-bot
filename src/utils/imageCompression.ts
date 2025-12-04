/**
 * Compress image file if it exceeds size limit
 * @param file - Image file to compress
 * @param maxSizeKB - Maximum size in KB (default: 1000KB = 1MB)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Compressed File or original file if compression not needed
 */
export async function compressImageIfNeeded(
  file: File,
  maxSizeKB: number = 1000,
  quality: number = 0.8
): Promise<File> {
  // Only compress image files
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  const fileSizeKB = file.size / 1024;
  const shouldCompressForSize = fileSizeKB > maxSizeKB;
  
  // Always optimize for Gemini 2.0 Flash pricing (768px width = 1 tile column)
  // We'll check the actual image dimensions during processing
  if (!shouldCompressForSize) {
    console.log(`[ImageCompression] File ${file.name} is ${fileSizeKB.toFixed(1)}KB, checking if optimization needed for Gemini pricing...`);
  } else {
    console.log(`[ImageCompression] File ${file.name} is ${fileSizeKB.toFixed(1)}KB, compressing...`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Receipt Optimization: Fix width to 768px for Gemini 2.0 Flash pricing
        // Gemini 2.0 charges per 768x768 tile. By fixing width to 768px, we guarantee
        // paying for only 1 column of tiles, whereas full-resolution might span 3-4 columns.
        // Always apply this optimization to reduce token costs, regardless of file size.
        const targetWidth = 768;
        const aspectRatio = img.height / img.width;
        const targetHeight = Math.round(targetWidth * aspectRatio);
        
        // If image is already 768px or smaller and file size is acceptable, return original
        if (img.width <= targetWidth && fileSizeKB <= maxSizeKB) {
          console.log(`[ImageCompression] File ${file.name} already optimized (${img.width}px width, ${fileSizeKB.toFixed(1)}KB)`);
          resolve(file);
          return;
        }
        
        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Convert to grayscale (L channel) to reduce file size
        // Create a temporary canvas to convert to grayscale
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          reject(new Error('Could not get temporary canvas context'));
          return;
        }
        
        // Draw original image to temp canvas
        tempCtx.drawImage(img, 0, 0);
        
        // Get image data and convert to grayscale
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          // Convert RGB to grayscale using luminance formula (L channel)
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          data[i] = gray;     // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
          // Alpha channel (data[i + 3]) remains unchanged
        }
        
        // Put grayscale data back
        tempCtx.putImageData(imageData, 0, 0);
        
        // Draw grayscale image to final canvas with target dimensions
        ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const compressedSizeKB = blob.size / 1024;
            console.log(`[ImageCompression] Compressed ${file.name} from ${fileSizeKB.toFixed(1)}KB to ${compressedSizeKB.toFixed(1)}KB`);

            // Create new File object with compressed data
            const compressedFile = new File(
              [blob],
              file.name,
              {
                type: 'image/jpeg', // Always convert to JPEG for better compression
                lastModified: file.lastModified
              }
            );

            // If still too large, try again with lower quality
            if (compressedSizeKB > maxSizeKB && quality > 0.5) {
              console.log(`[ImageCompression] Still too large, trying with lower quality...`);
              compressImageIfNeeded(compressedFile, maxSizeKB, quality - 0.1)
                .then(resolve)
                .catch(reject);
            } else {
              resolve(compressedFile);
            }
          },
          'image/jpeg', // Always use JPEG for better compression
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compress multiple image files
 */
export async function compressImagesIfNeeded(
  files: File[],
  maxSizeKB: number = 1000
): Promise<File[]> {
  const compressedFiles = await Promise.all(
    files.map(file => compressImageIfNeeded(file, maxSizeKB).catch(err => {
      console.error(`[ImageCompression] Failed to compress ${file.name}:`, err);
      return file; // Return original file if compression fails
    }))
  );
  
  return compressedFiles;
}

