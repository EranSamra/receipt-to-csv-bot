import { useState, useEffect } from "react";
import { Receipt, Sparkles, Zap, Shield, Brain, ArrowRight, CheckCircle } from "lucide-react";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ExamplesUpload } from "@/components/ExamplesUpload";
import { ExamplesModal } from "@/components/ExamplesModal";
import { ResultsTable, ReceiptData } from "@/components/ResultsTable";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { convertToCSV, downloadCSV } from "@/utils/csvUtils";
import { ParticleTextEffect } from "@/components/ui/particle-text-effect";
import { logMobileFileInfo, logMobileFetchInfo, logMobileError, detectMobileDevice } from "@/utils/mobileDebug";
import InvoiceScanModal from "@/components/InvoiceScanModal";
import MeshReceiptScanner from "@/components/MeshReceiptScanner";
import { SendCSVModal } from "@/components/SendCSVModal";
import { compressImageIfNeeded } from "@/utils/imageCompression";
import { MeshHeroCTA } from "@/components/MeshHeroCTA";
import { convertPDFToImage } from "@/utils/pdfConverter";
import { useAuth } from "@/contexts/AuthContext";
import { LoginModal } from "@/components/LoginModal";
import { UserMenu } from "@/components/UserMenu";
import { trackEvent, Events, trackError } from "@/utils/posthogEvents";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ReceiptData[]>([]);
  const [receiptImagesMap, setReceiptImagesMap] = useState<Map<string, string>>(new Map());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [animateHero, setAnimateHero] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showParticleEffect, setShowParticleEffect] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showMeshScanner, setShowMeshScanner] = useState(false);
  const [showSendCSVModal, setShowSendCSVModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const { toast } = useToast();
  const { user, loading: authLoading, isBusinessEmail, signOut } = useAuth();

  // Trigger animations on mount
  useEffect(() => {
    setAnimateHero(true);
  }, []);

  // Auto-scroll to output section when extraction completes
  useEffect(() => {
    if (showResults && results.length > 0) {
      // Wait for scanner to close and DOM to update before scrolling
      setTimeout(() => {
        const outputSection = document.getElementById('output-section');
        if (outputSection) {
          // Scroll to output section with smooth behavior
          outputSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 800); // Delay to ensure scanner is closed and results are rendered
    }
  }, [showResults, results]);

  // Monitor results to detect if they're being cleared unexpectedly
  useEffect(() => {
    if (results.length > 0) {
      console.log(`[Index] Results state updated: ${results.length} receipts`);
    } else if (showResults && results.length === 0) {
      console.warn(`[Index] WARNING: Results were cleared but showResults is still true!`);
    }
  }, [results, showResults]);

  // Validate business email after authentication and continue with extraction
  useEffect(() => {
    if (user?.email) {
      if (!isBusinessEmail(user.email)) {
        toast({
          title: "Business email required",
          description: "Please sign in with a business email address. Personal emails are not allowed.",
          variant: "destructive",
        });
        signOut();
        if (pendingFiles) {
          setShowLoginModal(true);
        }
      } else if (pendingFiles && pendingFiles.length > 0) {
        // User successfully logged in with business email, continue with extraction
        console.log('[Index] User authenticated, continuing with extraction');
        const filesToProcess = [...pendingFiles];
        setSelectedFiles(filesToProcess);
        setPendingFiles(null);
        setIsProcessing(true);
        setShowMeshScanner(true);
        setShowParticleEffect(false);
      }
    }
  }, [user, isBusinessEmail, signOut, toast, pendingFiles]);
  
  // Ensure selectedFiles persist after scanning completes
  // This is critical for blob URL validity
  useEffect(() => {
    if (showResults && results.length > 0 && selectedFiles.length === 0) {
      console.warn(`[Index] WARNING: selectedFiles was cleared but results exist! This may cause blob URL issues.`);
    }
  }, [showResults, results.length, selectedFiles.length]);

  const handleRemoveFile = (index: number) => {
    trackEvent(Events.FILE_REMOVED, {
      file_name: selectedFiles[index]?.name,
      remaining_files: selectedFiles.length - 1
    });
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    trackEvent(Events.FILES_CLEARED, {
      file_count: selectedFiles.length
    });
    setSelectedFiles([]);
    setShowResults(false);
    setResults([]);
  };

  const parseCSVToResults = (csvText: string, lineItemsData?: Array<{ invoiceNumber: string; lineItems: Array<{ description: string; date: string; amount: string; category: string }> }>): ReceiptData[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const dataRows = lines.slice(1);

    // Create a map of invoice numbers to line items
    const lineItemsMap = new Map<string, Array<{ description: string; date: string; amount: string; category: string }>>();
    if (lineItemsData) {
      lineItemsData.forEach(item => {
        if (item.invoiceNumber && item.lineItems && item.lineItems.length > 0) {
          lineItemsMap.set(item.invoiceNumber, item.lineItems);
        }
      });
    }

    return dataRows.map(row => {
      // Handle quoted fields with commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current);

      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
      });

      // Add line items if they exist for this invoice number
      const invoiceNumber = obj["Invoice Number"] || '';
      if (invoiceNumber && lineItemsMap.has(invoiceNumber)) {
        obj.lineItems = lineItemsMap.get(invoiceNumber);
      }

      return obj as ReceiptData;
    });
  };

  // Extract receipt function for MeshReceiptScanner
  const extractReceiptFn = async (file: File): Promise<{ ok: boolean; data?: any }> => {
    try {
      let fileToProcess = file;
      
      // Convert PDF to image if needed
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        console.log(`[Index] 📄 Detected PDF file: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
        console.log(`[Index] Converting PDF to image...`);
        
        try {
          // Add timeout for PDF conversion (30 seconds)
          const conversionPromise = convertPDFToImage(file, 'image/jpeg', 0.9);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('PDF conversion timeout after 30 seconds')), 30000)
          );
          
          fileToProcess = await Promise.race([conversionPromise, timeoutPromise]);
          
          console.log(`[Index] ✅ PDF converted successfully: ${file.name} -> ${fileToProcess.name}`);
          console.log(`[Index] Converted file details: type=${fileToProcess.type}, size=${(fileToProcess.size / 1024).toFixed(1)}KB`);
          
          // Track successful PDF conversion
          trackEvent(Events.PDF_CONVERTED, {
            file_name: file.name,
            file_size_kb: (file.size / 1024).toFixed(1),
            converted_size_kb: (fileToProcess.size / 1024).toFixed(1)
          });
          
          // Verify the converted file is valid
          if (!fileToProcess || fileToProcess.size === 0) {
            throw new Error('Converted file is empty');
          }
          
          if (!fileToProcess.type.startsWith('image/')) {
            throw new Error(`Converted file has invalid type: ${fileToProcess.type}`);
          }
        } catch (conversionError) {
          console.error(`[Index] ❌ PDF conversion failed for ${file.name}:`, conversionError);
          
          const errorMessage = conversionError instanceof Error 
            ? conversionError.message 
            : 'Unknown conversion error';
          
          // Track PDF conversion failure
          trackEvent(Events.PDF_CONVERSION_FAILED, {
            file_name: file.name,
            error: errorMessage,
            file_size_kb: (file.size / 1024).toFixed(1)
          });
          
          // Check if it's a timeout or critical error
          if (errorMessage.includes('timeout')) {
            throw new Error(`PDF conversion timed out. The PDF file may be too large or corrupted. Please try a smaller PDF or convert it to an image manually.`);
          }
          
          // Check if it's a worker/network issue
          if (errorMessage.includes('worker') || errorMessage.includes('connection')) {
            throw new Error(`PDF conversion failed: ${errorMessage}. Please check your internet connection and try again.`);
          }
          
          // For other errors, try fallback to PDF directly
          console.warn(`[Index] ⚠️ Attempting fallback: sending PDF directly to API (Gemini may support PDFs)...`);
          fileToProcess = file;
          console.warn(`[Index] ⚠️ PDF conversion failed (${errorMessage}), but continuing with PDF file directly. API may support PDF format.`);
        }
      }
      
      // Compress image if it's too large (over 1MB)
      const fileSizeMB = fileToProcess.size / (1024 * 1024);
      
      if (fileSizeMB > 1 && fileToProcess.type.startsWith('image/')) {
        console.log(`[Index] Compressing ${fileToProcess.name} (${fileSizeMB.toFixed(2)}MB)...`);
        try {
          fileToProcess = await compressImageIfNeeded(fileToProcess, 1000); // 1000KB = ~1MB
          const compressedSizeMB = fileToProcess.size / (1024 * 1024);
          console.log(`[Index] Compressed ${fileToProcess.name} from ${fileSizeMB.toFixed(2)}MB to ${compressedSizeMB.toFixed(2)}MB`);
          
          // Track image compression
          trackEvent(Events.IMAGE_COMPRESSED, {
            file_name: fileToProcess.name,
            original_size_mb: fileSizeMB.toFixed(2),
            compressed_size_mb: compressedSizeMB.toFixed(2),
            compression_ratio: ((1 - compressedSizeMB / fileSizeMB) * 100).toFixed(1) + '%'
          });
        } catch (compressionError) {
          console.warn(`[Index] Compression failed for ${fileToProcess.name}, using original file:`, compressionError);
          // Continue with original file if compression fails
        }
      }

      const formData = new FormData();
      formData.append('files', fileToProcess);

      // Environment-based API URL
      const API_URL = import.meta.env.DEV 
        ? 'http://localhost:3001/api/extract-receipts'
        : '/api/extract-receipts';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.csv || typeof data.csv !== 'string') {
        throw new Error('Invalid response format from server');
      }

      // Parse CSV to get receipt data
      const parsedResults = parseCSVToResults(data.csv, data.lineItems);
      
      console.log(`[Index] extractReceiptFn: Parsed ${parsedResults.length} receipt(s) from file ${file.name}`);
      
      if (parsedResults.length === 0) {
        console.warn(`[Index] WARNING: File ${file.name} produced 0 receipts after parsing CSV`);
        throw new Error('No valid receipt data extracted');
      }

      // Track successful file processing
      trackEvent(Events.EXTRACTION_FILE_PROCESSED, {
        file_name: file.name,
        receipt_count: parsedResults.length,
        file_type: file.type
      });

      // Return all parsed results (a single file can produce multiple receipts)
      return { ok: true, data: parsedResults };
    } catch (error: any) {
      console.error('Error extracting receipt:', error);
      trackError(error, {
        context: 'extraction',
        file_name: file.name,
        file_type: file.type
      });
      return { ok: false };
    }
  };

  const handleScanComplete = async (results: any[], fileIndices?: number[]) => {
    // Combine all results
    const allResults = results.filter(r => r !== null && r !== undefined);
    
    console.log(`[Index] handleScanComplete: Received ${results.length} results, ${allResults.length} after filtering null/undefined`);
    console.log(`[Index] Expected ${selectedFiles.length} files, got ${allResults.length} receipts`);
    
    if (allResults.length === 0) {
      trackEvent(Events.EXTRACTION_FAILED, {
        file_count: selectedFiles.length,
        error: 'no_results_extracted'
      });
      toast({
        title: "Processing failed",
        description: "No valid receipt data extracted",
        variant: "destructive",
      });
      setIsProcessing(false);
      // Delay closing to allow cleanup
      setTimeout(() => setShowMeshScanner(false), 100);
      return;
    }
    
    // Track extraction completion
    trackEvent(Events.EXTRACTION_COMPLETED, {
      receipt_count: allResults.length,
      file_count: selectedFiles.length,
      success: true
    });

    // Create blob URLs for receipt images and map them to invoice numbers
    // CRITICAL: Create blob URLs immediately and store them before scanner closes
    // This ensures they persist even if selectedFiles changes or scanner unmounts
    const imagesMap = new Map<string, string>();
    
    // Create blob URLs for ALL files immediately to ensure they persist
    // IMPORTANT: For PDFs, convert them to images first so they can be displayed
    // Store them in a map that won't be affected by scanner cleanup
    const fileBlobUrls = new Map<number, string>();
    
    // Process files and convert PDFs to images for preview
    const processFilesForPreview = async () => {
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        let fileForPreview = file;
        
        // If PDF, convert to image for preview
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            console.log(`[Index] Converting PDF ${file.name} to image for preview...`);
            fileForPreview = await convertPDFToImage(file, 'image/jpeg', 0.8);
            console.log(`[Index] ✅ PDF converted for preview: ${file.name} -> ${fileForPreview.name}`);
          } catch (error) {
            console.error(`[Index] Failed to convert PDF for preview, using original:`, error);
            // Use original file if conversion fails (won't display but won't crash)
            fileForPreview = file;
          }
        }
        
        // Create blob URL from the file (converted image for PDFs, original for images)
        fileBlobUrls.set(index, URL.createObjectURL(fileForPreview));
      }
    };
    
    await processFilesForPreview();
    
    // Map receipts to files using file indices from scanner
    // This ensures correct mapping even when some files fail to extract
    for (let receiptIndex = 0; receiptIndex < allResults.length; receiptIndex++) {
      const receipt = allResults[receiptIndex];
      const invoiceNumber = receipt["Invoice Number"] || '';
      
      // Get the file index for this receipt
      let fileIndex: number;
      if (fileIndices && fileIndices[receiptIndex] !== undefined) {
        // Use file index from scanner (correct mapping even if files failed)
        fileIndex = fileIndices[receiptIndex];
        console.log(`[Index] Receipt ${receiptIndex} mapped to file index ${fileIndex} (from scanner)`);
      } else {
        // Fallback: sequential mapping (shouldn't happen, but safe fallback)
        fileIndex = receiptIndex;
        console.warn(`[Index] No file index provided for receipt ${receiptIndex}, using sequential mapping as fallback`);
      }
      
      // Get blob URL for the file
      let blobUrl: string;
      if (fileIndex < fileBlobUrls.size && fileIndex >= 0) {
        blobUrl = fileBlobUrls.get(fileIndex)!;
        console.log(`[Index] Using blob URL from file index ${fileIndex} for receipt ${receiptIndex}`);
      } else {
        // Fallback: use last file's blob URL if index is out of bounds
        console.warn(`[Index] File index ${fileIndex} out of bounds, using last file's blob URL`);
        blobUrl = fileBlobUrls.get(fileBlobUrls.size - 1)!;
      }
      
      // Map this receipt to the blob URL
      if (invoiceNumber) {
        imagesMap.set(invoiceNumber, blobUrl);
        console.log(`[Index] Mapped receipt with invoice ${invoiceNumber} to file index ${fileIndex}`);
      } else {
        // Use index-based key if no invoice number
        imagesMap.set(`receipt-${receiptIndex}`, blobUrl);
        console.log(`[Index] Mapped receipt ${receiptIndex} (no invoice) to file index ${fileIndex}`);
      }
    }
    
    console.log(`[Index] Created ${imagesMap.size} image mappings from ${fileBlobUrls.size} files for ${allResults.length} receipts`);

    // DUPLICATE DETECTION: Check within this session's results
    console.log(`[Index] Running duplicate detection on ${allResults.length} receipts...`);
    const seen = new Map(); // merchant|date|amount -> index
    const seenByInvoice = new Map(); // invoice number -> index
    
    for (let i = 0; i < allResults.length; i++) {
      const receipt = allResults[i];
      
      // Method 1: Check by invoice number (strongest signal)
      const invoiceNumber = receipt["Invoice Number"]?.trim();
      if (invoiceNumber) {
        if (seenByInvoice.has(invoiceNumber)) {
          const firstIndex = seenByInvoice.get(invoiceNumber);
          allResults[firstIndex]["Duplicate"] = "Yes";
          receipt["Duplicate"] = "Yes";
          console.log(`✓ Duplicate found by invoice: #${invoiceNumber} (receipts ${firstIndex} and ${i})`);
        } else {
          seenByInvoice.set(invoiceNumber, i);
        }
      }
      
      // Method 2: Check by merchant + date + amount (normalized)
      const merchant = (receipt["Merchant"] || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const date = (receipt["Date"] || '').trim();
      const amountStr = (receipt["Amount"] || '').toString().trim();
      const amount = parseFloat(amountStr.replace(/[^\d.-]/g, '')) || 0;
      const normalizedAmount = amount.toFixed(2);
      
      const key = `${merchant}|${date}|${normalizedAmount}`;
      
      if (merchant && date && amount > 0) {
        if (seen.has(key)) {
          const firstIndex = seen.get(key);
          allResults[firstIndex]["Duplicate"] = "Yes";
          receipt["Duplicate"] = "Yes";
          console.log(`✓ Duplicate found by merchant+date+amount: ${merchant} on ${date} for $${normalizedAmount} (receipts ${firstIndex} and ${i})`);
        } else {
          seen.set(key, i);
        }
      }
    }
    
    const duplicateCount = allResults.filter(r => r["Duplicate"] === "Yes").length;
    console.log(`[Index] Duplicate detection complete: ${duplicateCount} duplicate(s) found in ${allResults.length} receipts`);
    
    // Track duplicate detection
    if (duplicateCount > 0) {
      trackEvent(Events.DUPLICATES_DETECTED, {
        duplicate_count: duplicateCount,
        total_receipts: allResults.length
      });
    }

    // IMPORTANT: Set results and images BEFORE closing scanner to prevent cleanup issues
    console.log(`[Index] Setting ${allResults.length} results, ${imagesMap.size} image mappings`);
    setReceiptImagesMap(imagesMap);
    setResults(allResults); // Use direct setResults here since we're intentionally setting new results
    setShowResults(true);
    setShowConfetti(true);
    setIsProcessing(false);
    
    // Verify results are set correctly
    setTimeout(() => {
      console.log(`[Index] Results state after 100ms: ${allResults.length} receipts`);
    }, 100);
    
    // Delay closing scanner to ensure state is set first
    // This prevents the scanner from revoking blob URLs before we've stored them
    setTimeout(() => {
      setShowMeshScanner(false);
      console.log(`[Index] Scanner closed, results should persist: ${allResults.length} receipts`);
      
      // Scroll to output section after scanner closes
      setTimeout(() => {
        const outputSection = document.getElementById('output-section');
        if (outputSection) {
          outputSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 300); // Small delay after scanner closes to ensure DOM is updated
    }, 200);
    
    // Hide confetti after animation (this should NOT affect results)
    setTimeout(() => {
      setShowConfetti(false);
      console.log(`[Index] Confetti hidden at 5s, checking results still exist...`);
      // Verify results haven't been cleared
      setTimeout(() => {
        console.log(`[Index] Results check after confetti: should still have ${allResults.length} receipts`);
      }, 100);
    }, 5000);
    
    toast({
      title: "✅ Data extracted successfully",
      description: "Your receipts have been processed using Mesh AI Extraction Engine.",
    });
  };

  const handleScanError = (error: Error) => {
    console.error('Scan error:', error);
    trackEvent(Events.EXTRACTION_FAILED, {
      error: error.message || 'unknown_error',
      file_count: selectedFiles.length
    });
    toast({
      title: "Processing failed",
      description: error.message || "Failed to process receipts",
      variant: "destructive",
    });
    setIsProcessing(false);
    setShowMeshScanner(false);
  };

  const handleProcess = () => {
    if (selectedFiles.length === 0) {
      trackEvent(Events.EXTRACTION_STARTED, { file_count: 0, error: 'no_files' });
      toast({
        title: "No files selected",
        description: "Please upload at least one receipt image",
        variant: "destructive",
      });
      return;
    }

    // Check authentication only when user uploads their own files (not examples)
    if (!user) {
      // Save files for later processing after login
      setPendingFiles([...selectedFiles]);
      trackEvent(Events.LOGIN_MODAL_OPENED, { trigger: 'extraction_required' });
      setShowLoginModal(true);
      return;
    }

    // Validate business email
    if (user.email && !isBusinessEmail(user.email)) {
      trackEvent(Events.LOGIN_FAILED, { reason: 'personal_email' });
      toast({
        title: "Business email required",
        description: "Please sign in with a business email address. Personal emails are not allowed.",
        variant: "destructive",
      });
      signOut();
      setPendingFiles([...selectedFiles]);
      setShowLoginModal(true);
      return;
    }

    // Track extraction start
    trackEvent(Events.EXTRACTION_STARTED, {
      file_count: selectedFiles.length,
      file_types: selectedFiles.map(f => f.type || 'unknown'),
      total_size_mb: (selectedFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(2)
    });

    // Proceed with extraction
    proceedWithExtraction();
  };

  const proceedWithExtraction = () => {
    const filesToProcess = pendingFiles || selectedFiles;
    
    if (filesToProcess.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one receipt image",
        variant: "destructive",
      });
      return;
    }

    // If we have pending files, update selectedFiles
    if (pendingFiles) {
      setSelectedFiles([...pendingFiles]);
      setPendingFiles(null);
    }

    // Track extraction start
    trackEvent(Events.EXTRACTION_STARTED, {
      file_count: filesToProcess.length,
      file_types: filesToProcess.map(f => f.type || 'unknown'),
      total_size_mb: (filesToProcess.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(2),
      source: pendingFiles ? 'after_login' : 'direct'
    });

    console.log(`[Index] proceedWithExtraction: Starting processing for ${filesToProcess.length} files`);
    setIsProcessing(true);
    setShowMeshScanner(true);
    setShowParticleEffect(false);
  };

  // Old handleProcess - keeping for backward compatibility but not used
  const handleProcessOld = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one receipt image",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setShowParticleEffect(true);

    try {
      // Simulate progress updates for better UX
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Mobile debugging - Log file info
      logMobileFileInfo(selectedFiles);

      const formData = new FormData();
      selectedFiles.forEach((file, index) => {
        formData.append('files', file);
        console.log(`📎 Added file ${index + 1}: ${file.name} (${file.type || 'NO TYPE'})`);
      });

      // Environment-based API URL: localhost for dev, relative path for production (Vercel)
      const API_URL = import.meta.env.DEV 
        ? 'http://localhost:3001/api/extract-receipts'
        : '/api/extract-receipts';

      // Mobile debugging - Log fetch info
      logMobileFetchInfo(API_URL, formData);

      // Enhanced mobile logs
      const deviceInfo = detectMobileDevice();
      console.log('🌐 API URL:', API_URL);
      console.log('📱 Device Type:', deviceInfo.isMobile ? 'Mobile' : 'Desktop');
      console.log('📱 User Agent:', navigator.userAgent);
      console.log('📊 Files to upload:', selectedFiles.length);
      console.log('💾 Total size:', selectedFiles.reduce((sum, f) => sum + f.size, 0), 'bytes');
      console.log('📱 Platform:', deviceInfo.platform);
      console.log('👆 Touch Support:', deviceInfo.touchSupport);
      
      // Create AbortController for timeout handling (mobile-friendly)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        clearInterval(progressInterval);
        setProcessingProgress(0);
      }, 120000); // 2 minute timeout

      let response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          // Note: Don't set Content-Type header - browser needs to set it with boundary for FormData
          // Accept header is fine though
          headers: {
            'Accept': 'application/json',
          },
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Mobile debugging - Log fetch error
        logMobileError(fetchError, 'Fetch Request');
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        
        if (fetchError.name === 'TypeError' && fetchError.message?.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your internet connection.');
        }
        
        // Mobile-specific: Convert non-Error objects to Error instances with proper message
        if (!(fetchError instanceof Error)) {
          let errorMsg = 'Network request failed';
          
          if (fetchError?.message && typeof fetchError.message === 'string') {
            errorMsg = fetchError.message;
          } else if (fetchError?.error && typeof fetchError.error === 'string') {
            errorMsg = fetchError.error;
          } else if (typeof fetchError === 'string') {
            errorMsg = fetchError;
          } else if (fetchError && typeof fetchError === 'object') {
            // Try to extract meaningful info
            const msg = fetchError.message || fetchError.error || fetchError.msg;
            errorMsg = (typeof msg === 'string' && msg !== '[object Object]') ? msg : 'Network request failed';
          }
          
          throw new Error(errorMsg);
        }
        
        throw fetchError;
      }

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) {
        let errorMessage = 'Failed to process receipts';
        const status = response.status;
        
        try {
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('application/json')) {
        const errorData = await response.json();
            
            // Safely extract error message
            if (typeof errorData === 'string') {
              errorMessage = errorData;
            } else if (errorData?.error && typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData?.message && typeof errorData.message === 'string') {
              errorMessage = errorData.message;
            } else if (typeof errorData === 'object') {
              // Try to extract from object without using JSON.stringify on nested objects
              const errorStr = JSON.stringify(errorData);
              if (errorStr && errorStr !== '{}' && errorStr !== 'null') {
                errorMessage = errorStr.length < 200 ? errorStr : `Server error: ${status}`;
              } else {
                errorMessage = `Server error: ${status}`;
              }
            } else {
              errorMessage = `Server error: ${status}`;
            }
          } else {
            // Try to get text response (mobile browsers might return HTML)
            try {
              const errorText = await response.text();
              errorMessage = errorText && errorText.length < 500 ? errorText : `Server error: ${status}`;
            } catch (textError) {
              errorMessage = `Server error: ${status} ${response.statusText || 'Unknown error'}`;
            }
          }
        } catch (parseError: any) {
          // If parsing fails completely, use status code
          errorMessage = `Server error: ${status} ${response.statusText || 'Unknown error'}`;
          console.error('Failed to parse error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      // Parse success response
      let data;
      try {
        data = await response.json();
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from server');
      }

        if (!data.csv || typeof data.csv !== 'string') {
          throw new Error('No CSV data received from server');
        }
        
        if (data.csv.trim().length === 0) {
          throw new Error('Received empty CSV data');
        }
      } catch (parseError: any) {
        if (parseError instanceof Error && parseError.message.includes('response format')) {
          throw parseError;
        }
        throw new Error(`Failed to parse server response: ${parseError.message || 'Unknown error'}`);
      }
      const parsedResults = parseCSVToResults(data.csv, data.lineItems);

      // Validate parsed results
      if (!parsedResults || parsedResults.length === 0) {
        throw new Error('No valid receipt data extracted. Please ensure your receipts contain extractable information.');
      }
      
      setResults(parsedResults);
      setShowResults(true);
      setShowConfetti(true);
      setShowScanModal(false);
      setShowParticleEffect(false);
      
      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 5000);
      
      toast({
        title: "✅ Data extracted successfully",
        description: "Your receipts have been processed using Mesh AI Extraction Engine.",
      });

    } catch (error: any) {
      // Cleanup handled in finally block
      
      // Mobile debugging - Log error details
      logMobileError(error, 'Receipt Processing');
      
      // Mobile-friendly error extraction - prevent "[object Object]"
      let errorMessage = "Failed to process receipts";
      let errorTitle = "Processing failed";
      
      // Comprehensive error extraction for mobile browsers
      if (error instanceof Error) {
        // Standard Error object
        errorMessage = error.message || String(error) || "Unknown error";
      } else if (error && typeof error === 'object') {
        // Handle error objects that aren't Error instances (common on mobile)
        
        // Try to extract message from common properties
        if (error.message && typeof error.message === 'string' && error.message !== '[object Object]') {
          errorMessage = error.message;
        } else if (error.error && typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (error.msg && typeof error.msg === 'string') {
          errorMessage = error.msg;
        } else if (error.statusText && typeof error.statusText === 'string') {
          errorMessage = error.statusText;
        } else {
          // Try to extract meaningful info from the object
          const errorKeys = Object.keys(error);
          if (errorKeys.length > 0) {
            // Try to find string values in the object
            let foundMessage = null;
            for (const key of errorKeys) {
              const value = error[key];
              if (typeof value === 'string' && value && value !== '[object Object]') {
                foundMessage = value;
                break;
              }
            }
            
            if (foundMessage) {
              errorMessage = foundMessage;
            } else {
              // Last resort: show error structure without "[object Object]"
              const errorSummary = errorKeys.slice(0, 3).map(key => {
                const val = error[key];
                if (typeof val === 'string') {
                  return `${key}: ${val.substring(0, 50)}`;
                } else if (typeof val === 'number' || typeof val === 'boolean') {
                  return `${key}: ${val}`;
                }
                return null;
              }).filter(Boolean).join(', ');
              
              errorMessage = errorSummary || "An error occurred. Please try again.";
            }
          } else {
            errorMessage = "An unexpected error occurred";
          }
        }
      } else if (error !== null && error !== undefined) {
        // Primitive types - convert to string safely
        try {
          errorMessage = String(error);
          // If it's still "[object Object]", provide a better message
          if (errorMessage === '[object Object]') {
            errorMessage = "An unexpected error occurred. Please try again.";
          }
        } catch (strError) {
          errorMessage = "An error occurred but could not be displayed";
        }
      }
      
      // Enhanced error categorization
      const lowerMessage = errorMessage.toLowerCase();
      
      if (lowerMessage.includes('timed out') || lowerMessage.includes('timeout') || lowerMessage.includes('aborted')) {
        errorTitle = "Request Timeout";
        errorMessage = "The request took too long. Please check your internet connection and try again.";
      } else if (lowerMessage.includes('network error') || lowerMessage.includes('failed to fetch') || lowerMessage.includes('networkerror') || lowerMessage.includes('load failed')) {
        errorTitle = "Network Error";
        errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      } else if (lowerMessage.includes('cors')) {
        errorTitle = "Connection Error";
        errorMessage = "Unable to connect to the server. Please try again.";
      } else if (lowerMessage.includes('json') || lowerMessage.includes('parse') || lowerMessage.includes('unexpected token')) {
        errorTitle = "Data Format Error";
        errorMessage = "The server returned invalid data. Please try again.";
      } else if (lowerMessage.includes('empty') || lowerMessage.includes('no valid')) {
        errorTitle = "No Data Extracted";
        errorMessage = "Unable to extract data from receipts. Please ensure your receipts are clear and readable.";
      } else if (lowerMessage.includes('quota') || lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
        errorTitle = "Service Limit Reached";
        errorMessage = "API quota exceeded. Please try again later.";
      } else if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized')) {
        errorTitle = "Authentication Error";
        errorMessage = "Authentication failed. Please contact support.";
      } else if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) {
        errorTitle = "Server Error";
        errorMessage = "An error occurred on the server. Please try again later.";
      } else if (lowerMessage.includes('object object') || errorMessage === '[object Object]') {
        // Mobile-specific: Catch "[object Object]" and provide helpful message
        errorTitle = "Processing Error";
        errorMessage = "An unexpected error occurred. Please check your internet connection and try again.";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setShowParticleEffect(false);
      setShowScanModal(false);
    }
  };

  const handleDownloadCSV = () => {
    if (results.length === 0) return;
    
    trackEvent(Events.CSV_DOWNLOADED, {
      receipt_count: results.length
    });
    
    const csv = convertToCSV(results);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `receipts-${timestamp}.csv`);
    
    toast({
      title: "CSV Downloaded",
      description: "Your expense data has been exported",
    });
  };

  const handleOpenExamplesModal = () => {
    trackEvent(Events.EXAMPLES_MODAL_OPENED);
    setShowExamplesModal(true);
  };

  const handleLoadSelectedExamples = (files: File[]) => {
    trackEvent(Events.EXAMPLES_LOADED, {
      example_count: files.length
    });
    
    setSelectedFiles(files);
    // Automatically start extraction after loading files
    // NOTE: Examples don't require authentication - they're for testing
    setIsProcessing(true);
    setShowMeshScanner(true);
    setShowParticleEffect(false);
    toast({
      title: "Starting extraction",
      description: `Extracting data from ${files.length} sample receipt${files.length > 1 ? 's' : ''}...`,
    });
  };

  return (
    <div className="min-h-screen mesh-gradient-dark">
      {/* Particle Text Effect Overlay */}
      {showParticleEffect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
          <div className="relative z-50">
            <ParticleTextEffect 
              words={["PROCESSING", "ANALYZING", "MESH AI", "EXTRACTING", "WORKING"]}
              width={800}
              height={400}
              className="rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Jumping Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {/* Confetti pieces with different shapes and colors */}
          {Array.from({ length: 120 }, (_, i) => (
            <div
              key={i}
              className="absolute confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                backgroundColor: ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'][Math.floor(Math.random() * 6)],
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                animationDelay: `${Math.random() * 1.5}s`,
                animationDuration: `${Math.random() * 2 + 4}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0%',
              }}
            />
          ))}
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-turquoise-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4000"></div>
        </div>

        <div className="relative container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <header className="text-center mb-8">
              {/* User Menu - Top Right */}
              <div className="flex justify-end mb-4">
                <UserMenu />
              </div>
              
              <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6 mesh-fade-in`}>
                <div className="p-1.5 bg-turquoise-500 rounded-full flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-white" />
                </div>
                <span className="text-white font-medium">Powered by Mesh AI</span>
            </div>
              
              <h1 className={`mesh-heading-xl mb-4 ${animateHero ? 'mesh-fade-in' : 'opacity-0'}`}>
                Receipt Data Extractor
              </h1>
              
              <div className={`mesh-text-lg max-w-3xl mx-auto mb-6 ${animateHero ? 'mesh-slide-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
                <p className="mb-4 leading-relaxed">
                  Upload your receipts and instantly convert them into structured expense data powered by AI.
                </p>
                <p className="leading-relaxed">
                  <span className="text-turquoise-400 font-semibold">Accurate. Secure. Built for Finance Teams.</span>
                </p>
              </div>

              {/* Feature Pills */}
              <div className={`flex flex-wrap justify-center gap-4 mb-8 ${animateHero ? 'mesh-scale-in' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Zap className="h-4 w-4 text-turquoise-400" />
                  <span className="text-white text-sm font-medium">AI-Powered</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Shield className="h-4 w-4 text-turquoise-400" />
                  <span className="text-white text-sm font-medium">Secure</span>
            </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Brain className="h-4 w-4 text-turquoise-400" />
                  <span className="text-white text-sm font-medium">Smart Extraction</span>
          </div>
        </div>
      </header>

            {/* Main Upload Cards */}
            <div className={`max-w-6xl mx-auto ${animateHero ? 'mesh-scale-in' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
              {selectedFiles.length === 0 ? (
                // Two cards side by side when no files selected
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-4 lg:gap-6 items-stretch">
                  {/* Upload Files Card */}
                  <div className="mesh-card p-4 sm:p-5 lg:p-6 mesh-shadow-xl h-full flex flex-col">
            <ReceiptUpload
              onFilesSelected={setSelectedFiles}
              selectedFiles={selectedFiles}
              onRemoveFile={handleRemoveFile}
            />
                  </div>
                  
                  {/* Examples Card */}
                  <div className="mesh-card p-4 sm:p-5 lg:p-6 mesh-shadow-xl h-full flex flex-col">
                    <ExamplesUpload
                      onOpenModal={handleOpenExamplesModal}
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>
              ) : (
                // Single expanded card when files are selected
                <div className="mesh-card p-4 sm:p-5 lg:p-6 mesh-shadow-xl">
                  <ReceiptUpload
                    onFilesSelected={setSelectedFiles}
                    selectedFiles={selectedFiles}
                    onRemoveFile={handleRemoveFile}
                    onClearFiles={handleClearFiles}
                    extractButton={
                      <div className="space-y-6">
                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    size="lg"
                          className="bg-[#14b8a6] hover:bg-[#0d9488] text-white font-semibold text-lg px-12 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                          {isProcessing ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5 mr-3" />
                              Extract Data
                            </>
                          )}
                  </Button>

                        {isProcessing && (
                          <div className="space-y-4">
                            <div className="bg-gray-100 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                              <div 
                                className="h-full mesh-gradient-primary transition-all duration-500 ease-out"
                                style={{ width: `${processingProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-center text-gray-600 font-medium">
                              Processing {selectedFiles.length} receipt{selectedFiles.length > 1 ? 's' : ''}... {processingProgress}%
                            </p>
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {showResults && results.length > 0 && (
        <>
          <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-10 right-10 w-32 h-32 bg-turquoise-500 rounded-full mix-blend-multiply filter blur-xl"></div>
              <div className="absolute bottom-10 left-10 w-24 h-24 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl"></div>
                </div>
                
            <div className="container mx-auto px-4 relative">
              <div className="max-w-6xl mx-auto">
                {/* Receipt Extraction Output Section */}
                <div id="output-section">
                  <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                      🎉 Extracted Receipt Data
                    </h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
                      Your receipts have been successfully processed and structured using Mesh AI
                    </p>
                    <div className="flex justify-center">
                      <Button
                        onClick={() => setShowSendCSVModal(true)}
                        className="bg-gradient-to-r from-turquoise-500 to-turquoise-600 hover:from-turquoise-600 hover:to-turquoise-700 text-white text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        <CheckCircle className="h-6 w-6 mr-3" />
                        Send CSV to my work email
                      </Button>
                    </div>
                  </div>

                  <div className="mesh-card p-8 mesh-shadow-xl border-2 border-turquoise-100">
                    <div className="mb-8">
                      <h3 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Expense Data</h3>
                      <p className="text-base md:text-lg text-gray-600">{results.length} receipt{results.length > 1 ? 's' : ''} processed successfully</p>
                    </div>
                    <ResultsTable data={results} receiptImages={receiptImagesMap} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Mesh Hero CTA Section */}
          <div className="container mx-auto px-4">
            <MeshHeroCTA />
          </div>
        </>
      )}

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <div className="space-y-2">
            <p className="text-white text-xl md:text-2xl font-bold">
              <span className="ml-4">Built with</span> <span className="text-red-500">❤️</span>
            </p>
            <p className="text-gray-400 text-sm md:text-base">
              Using Mesh AI Extraction Engine
            </p>
            <p className="text-gray-500 text-[10px] mt-4">
              Demo Use Only: Not for production. Receipt images are immediately discarded after processing. Provided 'as-is' without warranty. Please do not use real financial data
            </p>
          </div>
        </div>
      </footer>

      {/* Examples Modal */}
      <ExamplesModal
        isOpen={showExamplesModal}
        onClose={() => setShowExamplesModal(false)}
        onLoadSelected={handleLoadSelectedExamples}
      />

      {/* Mesh Receipt Scanner */}
      {showMeshScanner && selectedFiles.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-7xl">
            <MeshReceiptScanner
              key={`scanner-${selectedFiles.length}-${selectedFiles.map(f => `${f.name}-${f.size}`).join('|')}`}
              files={selectedFiles}
              onScanComplete={handleScanComplete}
              onError={handleScanError}
              extractReceiptFn={extractReceiptFn}
            />
          </div>
        </div>
      )}

      {/* Send CSV Modal */}
      <SendCSVModal
        isOpen={showSendCSVModal}
        onClose={() => setShowSendCSVModal(false)}
        extractedRows={results}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          // If user closes modal without logging in, clear pending files
          if (pendingFiles && !user) {
            setPendingFiles(null);
            setSelectedFiles([]);
          }
        }}
        onSuccess={() => {
          // User successfully logged in, can now proceed with upload
          // The useEffect will handle continuing with extraction
          console.log('[Index] User logged in successfully, will continue with extraction');
        }}
      />
    </div>
  );
};

export default Index;
