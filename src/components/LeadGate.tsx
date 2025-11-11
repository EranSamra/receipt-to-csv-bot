import { useEffect, useState } from 'react';

interface LeadGateProps {
  isOpen: boolean;
  onClose: () => void;
  onFormSubmitted: () => void;
}

declare global {
  interface Window {
    hbspt: {
      forms: {
        create: (config: {
          portalId: string;
          formId: string;
          region: string;
          target: string;
          onFormReady?: () => void;
          onFormSubmitted?: () => void;
        }) => void;
      };
    };
  }
}

export const LeadGate = ({ isOpen, onClose, onFormSubmitted }: LeadGateProps) => {
  const [formLoaded, setFormLoaded] = useState(false);

  useEffect(() => {
    // Load HubSpot script if not already loaded
    if (!window.hbspt) {
      const script = document.createElement('script');
      script.src = '//js.hsforms.net/forms/embed/v2.js';
      script.charset = 'utf-8';
      script.type = 'text/javascript';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        if (window.hbspt && isOpen) {
          loadForm();
        }
      };
    } else if (isOpen) {
      loadForm();
    }
  }, [isOpen]);

  const loadForm = () => {
    if (!window.hbspt) return;

    // Clear previous form if exists
    const formContainer = document.getElementById('hubspot-lead-form');
    if (formContainer) {
      formContainer.innerHTML = '';
    }

    window.hbspt.forms.create({
      portalId: '9157499',
      formId: '4ca21b58-81a3-48d5-a839-16d837f8178e',
      region: 'na1',
      target: '#hubspot-lead-form',
      onFormReady: () => {
        setFormLoaded(true);
      },
      onFormSubmitted: () => {
        // Mark as captured in localStorage
        localStorage.setItem('lead_captured', '1');
        onFormSubmitted();
        onClose();
      },
    });
  };

  // Apply blur to document when gate is open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add('lead-gated');
    } else {
      document.documentElement.classList.remove('lead-gated');
    }
    return () => {
      document.documentElement.classList.remove('lead-gated');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        id="lead-overlay"
        className="fixed inset-0 bg-black/45 z-[9998]"
        onClick={onClose}
      />

      {/* Modal */}
      <div id="lead-modal" className="fixed inset-0 grid place-items-center p-4 z-[9999] pointer-events-none">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl p-5 pointer-events-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Get the CSV to your email
          </h2>
          <p className="text-sm text-gray-600 text-center mb-3">
            Enter your email to continue. You will see your results right after.
          </p>

          {/* HubSpot form container */}
          <div id="hubspot-lead-form" className="min-h-[200px]">
            {!formLoaded && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-turquoise-500"></div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center mt-2">
            No spam. You can unsubscribe anytime.
          </p>
        </div>
      </div>
    </>
  );
};

