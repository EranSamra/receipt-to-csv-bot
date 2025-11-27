// Quick PostHog test - paste this in browser console
console.log('🧪 PostHog Quick Test');
console.log('PostHog available:', typeof posthog !== 'undefined');
if (typeof posthog !== 'undefined') {
  posthog.capture('test_event', { test: true, timestamp: Date.now() });
  console.log('✅ Test event sent! Check PostHog dashboard.');
} else {
  console.log('⚠️ PostHog not found. Make sure app is loaded.');
}
