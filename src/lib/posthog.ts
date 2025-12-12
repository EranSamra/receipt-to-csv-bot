import posthog from 'posthog-js';

// Helper function to check if an error is a PostHog internal error
const isPostHogInternalError = (error: any): boolean => {
  const errorMessage = error?.message || '';
  const errorString = String(error || '');
  
  return (
    errorMessage.includes('Object Not Found Matching') ||
    errorMessage.includes('MethodName') ||
    errorMessage.includes('ParamCount') ||
    errorString.includes('Object Not Found Matching') ||
    (errorString.includes('MethodName') && errorString.includes('update'))
  );
};

// Initialize PostHog
export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    // Check for localhost
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Skip initialization on localhost - events will be logged to console only
    if (isLocal) {
      console.log('[PostHog] Localhost detected - Events will be logged to console only');
      return;
    }
    
    try {
      const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
      if (!posthogKey) {
        console.warn('[PostHog] VITE_POSTHOG_KEY not set. PostHog analytics will be disabled.');
        return; // Exit early if no key
      }
      posthog.init(posthogKey, {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only', // Only create profiles for identified users
        autocapture: false, // Disabled to stop noisy "Click" events - we track meaningful actions explicitly
        capture_pageview: true, // Capture page views
        capture_pageleave: true, // Capture when users leave the page
        loaded: (posthogInstance) => {
          // Enable debug mode in development
          if (import.meta.env.DEV) {
            posthogInstance.debug();
          }
          
          // Intercept PostHog's exception tracking to filter out internal errors
          // PostHog automatically tracks unhandled rejections, so we need to filter them
          const originalCaptureException = posthogInstance.captureException;
          if (originalCaptureException) {
            posthogInstance.captureException = function(error: any, properties?: any) {
              // Filter out PostHog internal errors
              if (isPostHogInternalError(error)) {
                if (import.meta.env.DEV) {
                  console.warn('[PostHog] Suppressed internal error from tracking:', error?.message || String(error || ''));
                }
                return; // Don't track internal PostHog errors
              }
              
              // Track legitimate application errors
              return originalCaptureException.call(this, error, properties);
            };
          }
        }
      });
      
      console.log('[PostHog] Analytics initialized');
    } catch (error) {
      console.error('[PostHog] Initialization error:', error);
    }
    
    // Suppress unhandled promise rejections from PostHog
    // This prevents them from showing in console AND being tracked by PostHog
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        // Check if it's a PostHog-related error
        const errorMessage = event.reason?.message || String(event.reason || '');
        const errorString = String(event.reason || '');
        
        if (isPostHogInternalError(event.reason)) {
          if (import.meta.env.DEV) {
            console.warn('[PostHog] Suppressed promise rejection:', errorMessage || errorString);
          }
          event.preventDefault(); // Prevent the error from showing in console
          event.stopPropagation(); // Stop it from propagating to PostHog's exception handler
        }
      });
    }
  }
};

export { posthog };

