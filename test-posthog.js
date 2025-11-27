/**
 * PostHog Event Tracking Test Script
 * 
 * This script helps verify that all PostHog events are properly configured.
 * Run this in the browser console after the app loads.
 */

(function() {
  console.log('🧪 PostHog Event Tracking Test Suite');
  console.log('=====================================\n');

  // Check if PostHog is available
  const checkPostHog = () => {
    if (typeof window === 'undefined') {
      console.error('❌ Not in browser environment');
      return false;
    }

    // Try to access PostHog from window or module
    const posthog = window.posthog || (window.__POSTHOG__ && window.__POSTHOG__.posthog);
    
    if (!posthog) {
      console.warn('⚠️ PostHog not found. Make sure the app is loaded and PostHog is initialized.');
      console.log('💡 Check console for "[PostHog] Analytics initialized" message');
      return false;
    }

    console.log('✅ PostHog is loaded and available');
    return posthog;
  };

  // Test event tracking
  const testEventTracking = (posthog) => {
    console.log('\n📊 Testing Event Tracking...');
    
    const testEvents = [
      { name: 'test_file_uploaded', props: { file_count: 1, file_types: ['image/jpeg'] } },
      { name: 'test_extraction_started', props: { file_count: 2 } },
      { name: 'test_login_attempted', props: { email_domain: 'example.com' } },
    ];

    testEvents.forEach(({ name, props }) => {
      try {
        posthog.capture(name, props);
        console.log(`✅ Sent test event: ${name}`, props);
      } catch (error) {
        console.error(`❌ Failed to send event ${name}:`, error);
      }
    });
  };

  // Verify event constants (if available in window)
  const verifyEventConstants = () => {
    console.log('\n📋 Event Constants Check...');
    
    // Expected events from Events object
    const expectedEvents = [
      'FILE_UPLOADED',
      'EXTRACTION_STARTED',
      'EXTRACTION_COMPLETED',
      'EXTRACTION_FAILED',
      'CSV_DOWNLOADED',
      'LOGIN_MODAL_OPENED',
      'LOGIN_ATTEMPTED',
      'LOGIN_SUCCESS',
      'EXAMPLES_MODAL_OPENED',
      'SEND_CSV_MODAL_OPENED',
      'LEAD_FORM_SUBMITTED',
      'PDF_CONVERTED',
      'DUPLICATES_DETECTED',
      'ERROR_OCCURRED'
    ];

    console.log('Expected events:', expectedEvents.length);
    console.log('💡 Event constants are defined in src/utils/posthogEvents.ts');
    console.log('💡 Import and use: import { Events, trackEvent } from "@/utils/posthogEvents"');
  };

  // Check network requests
  const checkNetworkRequests = () => {
    console.log('\n🌐 Network Request Check...');
    console.log('💡 Open DevTools → Network tab');
    console.log('💡 Filter by "posthog" or "us.i.posthog.com"');
    console.log('💡 Look for POST requests to /e/ endpoint');
    console.log('💡 Check request payload for event data');
  };

  // Main test function
  const runTests = () => {
    const posthog = checkPostHog();
    
    if (posthog) {
      testEventTracking(posthog);
    }
    
    verifyEventConstants();
    checkNetworkRequests();
    
    console.log('\n✅ Test suite complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Perform actions in the app (upload files, extract, etc.)');
    console.log('2. Check PostHog dashboard for events');
    console.log('3. Check Network tab for API calls');
    console.log('4. Review POSTHOG_TESTING.md for detailed test checklist');
  };

  // Run tests
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
  } else {
    runTests();
  }
})();

