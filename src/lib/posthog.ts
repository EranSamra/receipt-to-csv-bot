import posthog from 'posthog-js';

// Initialize PostHog
export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    posthog.init('phc_kSsmb6ik2SkurBjueH4AFYPK4D50w9yTPIwKdb0Xtc3', {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only', // Only create profiles for identified users
      autocapture: true, // Automatically capture clicks, page views, etc.
      capture_pageview: true, // Capture page views
      capture_pageleave: true, // Capture when users leave the page
      loaded: (posthog) => {
        // Enable debug mode in development
        if (import.meta.env.DEV) {
          posthog.debug();
        }
      }
    });
    
    console.log('[PostHog] Analytics initialized');
  }
};

export { posthog };

