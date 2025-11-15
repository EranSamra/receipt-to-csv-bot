import { useEffect, useRef } from 'react';

interface HubSpotFormProps {
  portalId: string;
  formId: string;
  region?: string;
}

declare global {
  interface Window {
    hbspt?: {
      forms: {
        create: (options: {
          portalId: string;
          formId: string;
          region?: string;
          target: string;
          onFormReady?: () => void;
        }) => void;
      };
    };
  }
}

// Short, AI-focused privacy text
const SHORT_LEGAL_HTML = `
  <strong>Privacy Notice</strong><br>
  Mesh Payments uses AI to process and analyze receipt data securely.
  We use your details only to provide the demo or services you request.
  You can unsubscribe anytime. See our
  <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
  <br><br>
  By clicking submit, you agree that Mesh Payments may store and process your information for this purpose.
`;

function resultsReady(): boolean {
  const out = document.getElementById('output-section');
  return !!(out && out.innerHTML.trim() !== '');
}

function scrollFormIntoView(): void {
  const el = document.getElementById('lead-capture');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function enhanceHubSpotForm(root: HTMLElement): void {
  const legal = root.querySelector('.legal-consent-container, .hs-richtext, .hs-dependent-field');
  if (legal) {
    legal.innerHTML = SHORT_LEGAL_HTML;
  }
  
  const placeholders: Record<string, string> = {
    email: 'name@company.com',
    company: 'Company name'
  };
  
  Object.keys(placeholders).forEach(name => {
    const input = root.querySelector(`[name='${name}']`) as HTMLInputElement;
    if (input && !input.placeholder) {
      input.placeholder = placeholders[name];
    }
  });

  // Change submit button text
  const submitButton = root.querySelector('input[type="submit"]') as HTMLInputElement;
  if (submitButton) {
    submitButton.value = 'Get My Demo';
  }
}

export const HubSpotForm = ({ portalId, formId, region = 'na1' }: HubSpotFormProps) => {
  const formCreatedRef = useRef(false);

  useEffect(() => {
    function mountForm() {
      if (window.hbspt && !formCreatedRef.current) {
        try {
          // Updated form creation matching the new script format
          window.hbspt.forms.create({
            portalId,
            formId,
            region,
            target: '#hubspot-form',
            onFormReady: () => {
              const hubspotFormRoot = document.getElementById('hubspot-form');
              if (hubspotFormRoot) {
                enhanceHubSpotForm(hubspotFormRoot);
                scrollFormIntoView();
                
                // Change submit button text (with retry in case form renders async)
                const changeButtonText = () => {
                  const submitButton = hubspotFormRoot.querySelector('input[type="submit"]') as HTMLInputElement;
                  if (submitButton) {
                    submitButton.value = 'Get My Demo';
                  }
                };
                
                // Try immediately
                changeButtonText();
                
                // Also watch for button to appear (in case form renders async)
                const observer = new MutationObserver(() => {
                  changeButtonText();
                });
                observer.observe(hubspotFormRoot, { childList: true, subtree: true });
                
                // Stop observing after 5 seconds
                setTimeout(() => observer.disconnect(), 5000);
                
                // Hide sticky CTA when form is ready
                const stickyCta = document.getElementById('sticky-cta');
                if (stickyCta) {
                  stickyCta.classList.add('hidden');
                }
              }
            }
          });
          formCreatedRef.current = true;
        } catch (error) {
          console.error('Error creating HubSpot form:', error);
        }
      }
    }

    // Check if results are ready
    if (resultsReady()) {
      mountForm();
    } else {
      // Check periodically until results are ready
      const checkInterval = setInterval(() => {
        if (resultsReady() && !formCreatedRef.current) {
          clearInterval(checkInterval);
          mountForm();
        }
      }, 300);

      // Fallback: mount form after 6 seconds even if results aren't ready
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (!formCreatedRef.current) {
          mountForm();
        }
      }, 6000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [portalId, formId, region]);

  // This component doesn't render anything - the form is injected into #hubspot-form
  return null;
};

