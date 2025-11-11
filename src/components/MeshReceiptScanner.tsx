import React, { useMemo, useRef, useState } from "react";
import Lottie from "lottie-react";
import "./scanner.css";

type Item = {
  id: string;
  file: File;
  url: string;
  status: "queued" | "scanning" | "done" | "error";
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Wrap any async call so total visible time is at least 1.5s (reduced for faster scanning)
async function withMinDuration<T>(promise: Promise<T>, minMs = 1500): Promise<T> {
  const start = performance.now();
  try {
    const result = await promise;
    const elapsed = performance.now() - start;
    if (elapsed < minMs) await sleep(minMs - elapsed);
    return result;
  } catch (error) {
    // Don't add delay on error, fail fast
    throw error;
  }
}

type MeshReceiptScannerProps = {
  files: File[];
  onScanComplete: (results: any[]) => void;
  onError?: (error: Error) => void;
  extractReceiptFn: (file: File) => Promise<{ ok: boolean; data?: any }>;
};

export default function MeshReceiptScanner({ 
  files, 
  onScanComplete, 
  onError,
  extractReceiptFn 
}: MeshReceiptScannerProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [lottieKey, setLottieKey] = useState(0);
  const [lottieData, setLottieData] = useState<any>(null);

  // Load Lottie animation data
  React.useEffect(() => {
    fetch('/scan_effect.json')
      .then(res => res.json())
      .then(data => setLottieData(data))
      .catch(err => console.warn('Could not load Lottie animation:', err));
  }, []);

  // Initialize items from files prop
  React.useEffect(() => {
    console.log(`[Scanner] Files prop changed: ${files.length} files`);
    
    if (files.length === 0) {
      console.log(`[Scanner] No files, clearing items and resetting state`);
      // Clean up existing items before clearing
      setItems(prev => {
        prev.forEach(item => {
          if (item.url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(item.url);
            } catch (e) {
              // URL might already be revoked, ignore
            }
          }
        });
        return [];
      });
      setActiveIndex(0);
      setIsScanning(false); // Reset scanning state
      return;
    }

    // Reset scanning state when new files arrive
    setIsScanning(false);

    // Clean up old items before creating new ones
    setItems(prev => {
      prev.forEach(item => {
        if (item.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(item.url);
          } catch (e) {
            // URL might already be revoked, ignore
          }
        }
      });
      return [];
    });

    // Create new items with fresh blob URLs
    const newItems: Item[] = files.map((f, index) => ({
      id: `${Date.now()}-${f.name}-${index}-${Math.random()}`,
      file: f,
      url: URL.createObjectURL(f),
      status: "queued" as const,
    }));

    console.log(`[Scanner] Created ${newItems.length} items from files`);
    setItems(newItems);
    if (newItems.length > 0) setActiveIndex(0);
  }, [files]);

  // Cleanup URLs on unmount
  React.useEffect(() => {
    return () => {
      setItems(prev => {
        prev.forEach(item => {
          if (item.url.startsWith('blob:')) {
            URL.revokeObjectURL(item.url);
          }
        });
        return [];
      });
    };
  }, []);

  const total = items.length;
  const completed = items.filter((i) => i.status === "done").length;
  const current = items[activeIndex];
  const batchProgress = total === 0 ? 0 : Math.round((completed / total) * 100);

  async function startScan() {
    if (isScanning) {
      console.warn(`[Scanner] startScan called but already scanning. Ignoring.`);
      return;
    }
    if (items.length === 0) {
      console.warn(`[Scanner] startScan called but items.length is 0. Ignoring.`);
      return;
    }
    console.log(`[Scanner] Starting scan for ${items.length} files`);
    setIsScanning(true);

    const results: any[] = [];
    
    // Capture current items array to avoid stale closures
    const currentItems = [...items];

    for (let i = 0; i < currentItems.length; i++) {
      const currentItem = currentItems[i];
      setActiveIndex(i);
      
      // Update status to scanning
      setItems((prev) => prev.map((it, idx) => 
        it.id === currentItem.id ? { ...it, status: "scanning" } : it
      ));
      setLottieKey((k) => k + 1); // restart animation when item changes

      const startTime = performance.now();
      console.log(`[Scanner] Starting extraction for file ${i + 1}/${currentItems.length}: ${currentItem.file.name}`);

      try {
        
        // Add a timeout wrapper to prevent hanging (60 seconds max per file - PDFs may take longer)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Extraction timeout after 60 seconds')), 60000);
        });
        
        // Use the captured file reference, not from state
        const extractionPromise = extractReceiptFn(currentItem.file);
        const res = await withMinDuration(
          Promise.race([extractionPromise, timeoutPromise]),
          1500
        );
        
        const elapsed = performance.now() - startTime;
        console.log(`[Scanner] Completed file ${i + 1}/${currentItems.length} in ${Math.round(elapsed)}ms`);

        if (res.ok && res.data) {
          // res.data can be a single receipt or an array of receipts
          const receiptData = Array.isArray(res.data) ? res.data : [res.data];
          console.log(`[Scanner] File ${i + 1}/${currentItems.length} produced ${receiptData.length} receipt(s)`);
          
          if (receiptData.length === 0) {
            console.warn(`[Scanner] WARNING: File ${i + 1} (${currentItem.file.name}) returned ok=true but 0 receipts!`);
            setItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id ? { ...it, status: "error", error: "No receipts extracted" } : it
              )
            );
          } else {
            results.push(...receiptData); // Spread to add all receipts
            console.log(`[Scanner] Added ${receiptData.length} receipt(s) to results. Total so far: ${results.length}`);
            
            // Update status using item ID to avoid index issues
            setItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id ? { ...it, status: "done" } : it
              )
            );
          }
        } else {
          console.error(`[Scanner] File ${i + 1} (${currentItem.file.name}) extraction failed: ok=${res.ok}, hasData=${!!res.data}`);
          setItems((prev) =>
            prev.map((it) =>
              it.id === currentItem.id ? { ...it, status: "error", error: "Failed to extract" } : it
            )
          );
        }
      } catch (error: any) {
        const elapsed = performance.now() - startTime;
        const isPDF = currentItem.file.type === 'application/pdf' || currentItem.file.name.toLowerCase().endsWith('.pdf');
        console.error(`[Scanner] Error processing file ${i + 1}/${currentItems.length} (${isPDF ? 'PDF' : 'Image'}) after ${Math.round(elapsed)}ms:`, error);
        console.error(`[Scanner] Error details - name: ${error.name}, message: ${error.message}, stack: ${error.stack?.substring(0, 500)}`);
        
        const errorObj = error instanceof Error ? error : new Error(error?.message || "Failed to extract receipt");
        const errorMessage = errorObj.message || (isPDF ? "PDF processing failed" : "Failed to extract receipt");
        setItems((prev) =>
          prev.map((it) =>
            it.id === currentItem.id ? { ...it, status: "error", error: errorMessage } : it
          )
        );
        
        // Don't call onError for individual file failures, only log
        // onError will be called at the end if all files fail
        console.warn(`[Scanner] File ${i + 1} (${currentItem.file.name}) failed, continuing with remaining files...`);
      }
    }

    setIsScanning(false);
    
    console.log(`[Scanner] Scan complete. Processed ${currentItems.length} files, extracted ${results.length} receipts`);
    
    // Log summary - note: items state might be stale, so we log what we know from processing
    console.log(`[Scanner] Successfully extracted receipts from ${results.length > 0 ? 'some' : 'no'} files`);
    
    // Count successful vs failed files
    const successfulFiles = currentItems.filter((item, idx) => {
      // Check if this file produced results
      // Since we process sequentially, we can check by index
      return results.length > idx || results.some(r => r !== null && r !== undefined);
    }).length;
    
    console.log(`[Scanner] Summary: ${successfulFiles}/${currentItems.length} files produced results, ${results.length} total receipts extracted`);
    
    if (results.length > 0) {
      console.log(`[Scanner] Calling onScanComplete with ${results.length} receipts`);
      onScanComplete(results);
    } else {
      // Check if any items have errors - but wait for state to update
      setTimeout(() => {
        setItems((prev) => {
          const hasErrors = prev.some(i => i.status === "error");
          const allFailed = prev.every(i => i.status === "error" || i.status === "queued");
          
          console.log(`[Scanner] Error check: hasErrors=${hasErrors}, allFailed=${allFailed}, results.length=${results.length}`);
          
          if (allFailed && results.length === 0 && onError) {
            console.error(`[Scanner] All files failed. Calling onError`);
            const errorMsg = hasErrors 
              ? "All receipts failed to extract. Please check the console for details."
              : "No receipts were extracted. Please ensure your files are valid receipts.";
            onError(new Error(errorMsg));
          } else if (results.length === 0 && !allFailed) {
            // Some files might still be processing, wait a bit more
            console.warn(`[Scanner] No results yet but not all failed. Waiting...`);
          }
          return prev;
        });
      }, 500); // Wait 500ms for state to update
    }
  }

  // Auto-start scan when component mounts with files
  React.useEffect(() => {
    if (items.length > 0 && !isScanning) {
      console.log(`[Scanner] Auto-starting scan for ${items.length} files`);
      // Use setTimeout to ensure state is fully updated
      const timer = setTimeout(() => {
        startScan();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      console.log(`[Scanner] Not starting scan: items.length=${items.length}, isScanning=${isScanning}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find(i => i.id === id);
      if (item && item.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.url);
        } catch (e) {
          // URL might already be revoked, ignore
          console.warn('Failed to revoke blob URL:', e);
        }
      }
      const newItems = prev.filter((i) => i.id !== id);
      if (activeIndex >= newItems.length && newItems.length > 0) {
        setActiveIndex(newItems.length - 1);
      } else if (newItems.length === 0) {
        setActiveIndex(0);
      }
      return newItems;
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="scanner-wrap">
      <div className="scanner-card">
        <div className="batch-bar">
          <div className="batch-meta">
            {isScanning ? (
              <span>Scanning {Math.min(completed + 1, total)} of {total}</span>
            ) : (
              <span>{total} receipt{total > 1 ? "s" : ""} loaded</span>
            )}
          </div>
          <div className="batch-actions">
            <button className="btn-primary" onClick={startScan} disabled={isScanning || items.length === 0}>
              {isScanning ? "Scanning..." : "Extract Data"}
            </button>
          </div>
          <div className="progress-rail">
            <div className="progress-fill" style={{ width: `${batchProgress}%` }} />
          </div>
        </div>

        <div className="preview-grid">
          <div className="preview-area">
            {current && (
              <div className={`preview-frame ${current.status === "scanning" ? "dim" : ""}`}>
                <img 
                  src={current.url} 
                  alt={current.file.name} 
                  className="preview-img"
                  onError={(e) => {
                    // If blob URL fails, try to recreate it
                    const target = e.target as HTMLImageElement;
                    try {
                      const newUrl = URL.createObjectURL(current.file);
                      target.src = newUrl;
                      // Update the item with new URL
                      setItems(prev => prev.map(item => 
                        item.id === current.id 
                          ? { ...item, url: newUrl }
                          : item
                      ));
                    } catch (err) {
                      console.error('Failed to recreate blob URL:', err);
                    }
                  }}
                />
                {current.status === "scanning" && lottieData && (
                  <div className="scan-overlay">
                    <Lottie
                      key={lottieKey}
                      animationData={lottieData}
                      loop={true}
                      autoplay={true}
                      className="lottie"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="thumb-tray">
            {items.map((it, idx) => (
              <div
                key={it.id}
                className={`thumb ${idx === activeIndex ? "thumb-active" : ""}`}
                onClick={() => setActiveIndex(idx)}
                title={
                  it.status === "scanning"
                    ? `Receipt ${idx + 1} of ${total} – scanning now`
                    : `Receipt ${idx + 1} of ${total} – ${it.status}`
                }
              >
                <img 
                  src={it.url} 
                  alt={it.file.name} 
                  className="thumb-img"
                  onError={(e) => {
                    // If blob URL fails, try to recreate it
                    const target = e.target as HTMLImageElement;
                    try {
                      const newUrl = URL.createObjectURL(it.file);
                      target.src = newUrl;
                      // Update the item with new URL
                      setItems(prev => prev.map(item => 
                        item.id === it.id 
                          ? { ...item, url: newUrl }
                          : item
                      ));
                    } catch (err) {
                      console.error('Failed to recreate blob URL:', err);
                    }
                  }}
                />
                {it.status === "error" ? (
                  <img 
                    src="/sample-receipts/status-error-icon.png" 
                    alt="Error" 
                    className="status-icon status-error-icon"
                  />
                ) : (
                  <div className={`status-dot status-${it.status}`} />
                )}
                <button className="thumb-remove" onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

