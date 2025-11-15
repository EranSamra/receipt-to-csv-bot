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

  // Check if file is already small enough
  const fileSizeKB = file.size / 1024;
  if (fileSizeKB <= maxSizeKB) {
    console.log(`[ImageCompression] File ${file.name} is ${fileSizeKB.toFixed(1)}KB, no compression needed`);
    return file;
  }

  console.log(`[ImageCompression] File ${file.name} is ${fileSizeKB.toFixed(1)}KB, compressing...`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions to reduce file size
        // Try to keep aspect ratio while reducing size
        let width = img.width;
        let height = img.height;
        const maxDimension = 2048; // Max width or height
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw image to canvas with new dimensions
        ctx.drawImage(img, 0, 0, width, height);

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

