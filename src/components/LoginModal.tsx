import { useEffect, useRef, useState } from "react";
import { X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LoginModal = ({ isOpen, onClose, onSuccess }: LoginModalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wcElementRef = useRef<HTMLElement | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Check if Descope script is loaded
  useEffect(() => {
    const checkScript = () => {
      // Check if custom element is defined (means script loaded)
      if (customElements.get('descope-wc')) {
        console.log('[LoginModal] Descope script loaded successfully');
        setScriptLoaded(true);
        setScriptError(false);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkScript()) return;

    // Check if script tag exists
    const scriptTag = document.querySelector('script[src*="descope"]');
    if (!scriptTag) {
      console.error('[LoginModal] Descope script tag not found in DOM');
      setScriptError(true);
      return;
    }

    // Wait for script to load
    const maxRetries = 20; // 10 seconds max
    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      if (checkScript()) {
        clearInterval(interval);
      } else if (retries >= maxRetries) {
        console.error('[LoginModal] Descope script failed to load after timeout');
        clearInterval(interval);
        setScriptError(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [retryCount]);

  useEffect(() => {
    if (isOpen && containerRef.current && scriptLoaded) {
      // Create Descope web component if it doesn't exist
      let wcElement = document.getElementsByTagName('descope-wc')[0] as HTMLElement;
      
      if (!wcElement) {
        try {
          wcElement = document.createElement('descope-wc') as HTMLElement;
          wcElement.setAttribute('project-id', 'P35v4osxBEfKnEOpBAH5xwKj8b3M');
          wcElement.setAttribute('flow-id', 'sign-in');
          wcElement.setAttribute('theme', 'light');
          containerRef.current.appendChild(wcElement);
          console.log('[LoginModal] Descope web component created');
        } catch (error) {
          console.error('[LoginModal] Error creating Descope component:', error);
          setScriptError(true);
        }
      } else {
        // Move existing element to container
        containerRef.current.appendChild(wcElement);
        console.log('[LoginModal] Using existing Descope component');
      }
      
      wcElementRef.current = wcElement;
      wcElement.style.display = 'block';
    } else if (!isOpen && wcElementRef.current) {
      // Hide component when modal closes
      wcElementRef.current.style.display = 'none';
    }
  }, [isOpen, scriptLoaded]);

  useEffect(() => {
    const wcElement = wcElementRef.current || document.getElementsByTagName('descope-wc')[0];
    if (!wcElement) return;

    const onSuccessHandler = (e: CustomEvent) => {
      console.log('[LoginModal] Descope success:', e.detail);
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    };

    const onErrorHandler = (err: CustomEvent) => {
      console.error('[LoginModal] Descope error:', err);
      setScriptError(true);
    };

    wcElement.addEventListener('success', onSuccessHandler as EventListener);
    wcElement.addEventListener('error', onErrorHandler as EventListener);

    return () => {
      wcElement.removeEventListener('success', onSuccessHandler as EventListener);
      wcElement.removeEventListener('error', onErrorHandler as EventListener);
    };
  }, [onClose, onSuccess]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setScriptError(false);
    setScriptLoaded(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4"
        >
          <X className="h-4 w-4" />
        </Button>

        <h2 className="text-2xl font-bold mb-4 text-gray-800">Sign In Required</h2>
        <p className="text-gray-600 mb-2">
          Please sign in with your <strong>business email</strong> to upload and process receipts.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Personal email addresses (Gmail, Yahoo, etc.) are not accepted.
        </p>

        <div ref={containerRef} className="min-h-[400px]">
          {scriptError ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Failed to load authentication
              </h3>
              <p className="text-sm text-gray-600 mb-4 max-w-sm">
                The authentication service couldn't be loaded. This might be due to:
              </p>
              <ul className="text-xs text-gray-500 mb-6 text-left list-disc list-inside space-y-1">
                <li>Network connectivity issues</li>
                <li>Firewall or proxy blocking the request</li>
                <li>Script loading timeout</li>
              </ul>
              <Button onClick={handleRetry} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <p className="text-xs text-gray-400 mt-4">
                Running locally? Make sure you have internet connection and Descope allows localhost.
              </p>
            </div>
          ) : !scriptLoaded ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mb-4" />
              <p className="text-sm text-gray-600">Loading authentication...</p>
            </div>
          ) : (
            /* Descope web component will be inserted here */
            null
          )}
        </div>
      </div>
    </div>
  );
};

