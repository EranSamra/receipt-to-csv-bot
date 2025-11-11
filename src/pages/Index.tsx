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
  const { toast } = useToast();

  // Trigger animations on mount
  useEffect(() => {
    setAnimateHero(true);
  }, []);

  // Auto-scroll to results when extraction completes
  useEffect(() => {
    if (showResults && results.length > 0) {
      setTimeout(() => {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
          resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 500); // Small delay to allow animation to complete
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
  
  // Ensure selectedFiles persist after scanning completes
  // This is critical for blob URL validity
  useEffect(() => {
    if (showResults && results.length > 0 && selectedFiles.length === 0) {
      console.warn(`[Index] WARNING: selectedFiles was cleared but results exist! This may cause blob URL issues.`);
    }
  }, [showResults, results.length, selectedFiles.length]);

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
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
      const formData = new FormData();
      formData.append('files', file);

      // Environment-based API URL
      const API_URL = import.meta.env.DEV 
        ? 'http://localhost:3001/api/extract-receipts'
        : '/api/extract-receipts';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes for PDFs

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

      // Return all parsed results (a single file can produce multiple receipts)
      return { ok: true, data: parsedResults };
    } catch (error: any) {
      console.error('Error extracting receipt:', error);
      return { ok: false };
    }
  };

  const handleScanComplete = (results: any[]) => {
    // Combine all results
    const allResults = results.filter(r => r !== null && r !== undefined);
    
    console.log(`[Index] handleScanComplete: Received ${results.length} results, ${allResults.length} after filtering null/undefined`);
    console.log(`[Index] Expected ${selectedFiles.length} files, got ${allResults.length} receipts`);
    
    if (allResults.length === 0) {
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

    // Create blob URLs for receipt images and map them to invoice numbers
    // CRITICAL: Create blob URLs immediately and store them before scanner closes
    // This ensures they persist even if selectedFiles changes or scanner unmounts
    const imagesMap = new Map<string, string>();
    
    // Create blob URLs for ALL files immediately to ensure they persist
    // Store them in a map that won't be affected by scanner cleanup
    const fileBlobUrls = new Map<number, string>();
    selectedFiles.forEach((file, index) => {
      // Create blob URL immediately - these will persist even after scanner closes
      fileBlobUrls.set(index, URL.createObjectURL(file));
    });
    
    // Map receipts to files: process all receipts and assign them to files
    // Since MeshReceiptScanner processes files sequentially and returns results in order,
    // we match receipts to files by index (one receipt per file, or multiple receipts from same file)
    let fileIndex = 0;
    
    for (let receiptIndex = 0; receiptIndex < allResults.length; receiptIndex++) {
      const receipt = allResults[receiptIndex];
      const invoiceNumber = receipt["Invoice Number"] || '';
      
      // Get blob URL for current file (or reuse if we've run out of files)
      let blobUrl: string;
      if (fileIndex < fileBlobUrls.size) {
        blobUrl = fileBlobUrls.get(fileIndex)!;
        // Move to next file after using this one (assumes one receipt per file)
        // If a file produces multiple receipts, they'll reuse the same blob URL
        fileIndex++;
      } else {
        // More receipts than files - reuse last file's blob URL
        // This handles cases where a single file produces multiple receipts
        blobUrl = fileBlobUrls.get(fileBlobUrls.size - 1)!;
      }
      
      // Map this receipt to the blob URL
      if (invoiceNumber) {
        imagesMap.set(invoiceNumber, blobUrl);
      } else {
        // Use index-based key if no invoice number
        imagesMap.set(`receipt-${receiptIndex}`, blobUrl);
      }
    }
    
    console.log(`[Index] Created ${imagesMap.size} image mappings from ${fileBlobUrls.size} files for ${allResults.length} receipts`);

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
      toast({
        title: "No files selected",
        description: "Please upload at least one receipt image",
        variant: "destructive",
      });
      return;
    }

    console.log(`[Index] handleProcess: Starting processing for ${selectedFiles.length} files`);
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
      }, 180000); // 3 minute timeout (PDFs may take longer)

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
    
    const csv = convertToCSV(results);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `receipts-${timestamp}.csv`);
    
    toast({
      title: "CSV Downloaded",
      description: "Your expense data has been exported",
    });
  };

  const handleOpenExamplesModal = () => {
    setShowExamplesModal(true);
  };

  const handleLoadSelectedExamples = (files: File[]) => {
    setSelectedFiles(files);
    toast({
      title: "Examples Loaded",
      description: `Loaded ${files.length} sample receipt${files.length > 1 ? 's' : ''} for testing`,
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

        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <header className="text-center mb-16">
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8 mesh-fade-in`}>
                <div className="p-2 bg-turquoise-500 rounded-lg">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-medium">Powered by Mesh AI</span>
              </div>
              
              <h1 className={`mesh-heading-xl mb-6 ${animateHero ? 'mesh-fade-in' : 'opacity-0'}`}>
                Receipt Data Extractor
              </h1>
              
              <p className={`mesh-text-lg max-w-3xl mx-auto mb-8 ${animateHero ? 'mesh-slide-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
                Upload your receipts and instantly convert them into structured expense data powered by AI. 
                <span className="text-turquoise-400 font-semibold"> Accurate. Secure. Built for Finance Teams.</span>
              </p>

              {/* Feature Pills */}
              <div className={`flex flex-wrap justify-center gap-4 mb-12 ${animateHero ? 'mesh-scale-in' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                  {/* Upload Files Card */}
                  <div className="mesh-card p-4 sm:p-6 lg:p-8 mesh-shadow-xl">
                    <ReceiptUpload
                      onFilesSelected={setSelectedFiles}
                      selectedFiles={selectedFiles}
                      onRemoveFile={handleRemoveFile}
                    />
                  </div>
                  
                  {/* Examples Card */}
                  <div className="mesh-card p-4 sm:p-6 lg:p-8 mesh-shadow-xl">
                    <ExamplesUpload
                      onOpenModal={handleOpenExamplesModal}
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>
              ) : (
                // Single expanded card when files are selected
                <div className="mesh-card p-4 sm:p-6 lg:p-8 mesh-shadow-xl">
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
        <section id="results-section" className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 right-10 w-32 h-32 bg-turquoise-500 rounded-full mix-blend-multiply filter blur-xl"></div>
            <div className="absolute bottom-10 left-10 w-24 h-24 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl"></div>
          </div>
          
          <div className="container mx-auto px-4 relative">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                  🎉 Extracted Receipt Data
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
                  Your receipts have been successfully processed and structured using Mesh AI
                </p>
                <div className="flex justify-center">
                  <Button
                    onClick={handleDownloadCSV}
                    className="bg-gradient-to-r from-turquoise-500 to-turquoise-600 hover:from-turquoise-600 hover:to-turquoise-700 text-white text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <CheckCircle className="h-6 w-6 mr-3" />
                    Download CSV
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
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            Built with ❤️ using Mesh AI Extraction Engine
          </p>
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
    </div>
  );
};

export default Index;
