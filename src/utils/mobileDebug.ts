/**
 * Mobile Debugging Utilities
 * Logs mobile-specific information to help identify issues
 */

export interface MobileDeviceInfo {
  isMobile: boolean;
  userAgent: string;
  platform: string;
  vendor: string;
  screenWidth: number;
  screenHeight: number;
  touchSupport: boolean;
  connection?: any;
}

export function detectMobileDevice(): MobileDeviceInfo {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  
  return {
    isMobile,
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    vendor: navigator.vendor || 'unknown',
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    connection: (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
  };
}

export function logMobileFileInfo(files: File[]): void {
  console.group('📱 Mobile File Upload Info');
  const deviceInfo = detectMobileDevice();
  
  console.log('Device Info:', deviceInfo);
  console.log('Total Files:', files.length);
  
  files.forEach((file, index) => {
    console.log(`File ${index + 1}:`, {
      name: file.name,
      type: file.type || 'EMPTY TYPE (Mobile Issue!)',
      size: `${(file.size / 1024).toFixed(2)} KB`,
      lastModified: new Date(file.lastModified).toISOString(),
      extension: file.name.split('.').pop()?.toLowerCase(),
      hasType: !!file.type,
      typeIssue: !file.type ? '⚠️ Missing MIME type - may be filtered out' : '✅ OK'
    });
  });
  
  // Check for potential issues
  const filesWithoutType = files.filter(f => !f.type);
  if (filesWithoutType.length > 0) {
    console.warn('⚠️ MOBILE ISSUE DETECTED:', {
      count: filesWithoutType.length,
      files: filesWithoutType.map(f => f.name),
      issue: 'Files without MIME type - may be HEIC files from iOS'
    });
  }
  
  console.groupEnd();
}

export function logMobileFetchInfo(url: string, formData: FormData): void {
  console.group('📱 Mobile Fetch Request Info');
  const deviceInfo = detectMobileDevice();
  
  console.log('Device Info:', deviceInfo);
  console.log('API URL:', url);
  console.log('FormData entries:', Array.from(formData.entries()).length);
  
  // Log network info if available
  if (deviceInfo.connection) {
    console.log('Network Info:', {
      effectiveType: deviceInfo.connection.effectiveType,
      downlink: deviceInfo.connection.downlink,
      rtt: deviceInfo.connection.rtt,
      saveData: deviceInfo.connection.saveData
    });
  }
  
  console.groupEnd();
}

export function logMobileError(error: any, context: string): void {
  console.group(`❌ Mobile Error: ${context}`);
  const deviceInfo = detectMobileDevice();
  
  console.log('Device Info:', deviceInfo);
  console.log('Error Type:', typeof error);
  console.log('Error Constructor:', error?.constructor?.name);
  console.log('Error Keys:', error ? Object.keys(error) : 'null');
  console.log('Full Error:', error);
  
  // Try to extract meaningful error info
  if (error instanceof Error) {
    console.log('Error Message:', error.message);
    console.log('Error Stack:', error.stack);
  } else if (error && typeof error === 'object') {
    console.log('Error Object:', JSON.stringify(error, null, 2));
  }
  
  console.groupEnd();
}

