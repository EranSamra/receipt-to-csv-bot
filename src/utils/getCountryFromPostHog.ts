import { posthog } from '@/lib/posthog';

/**
 * Get user's country code and name from PostHog
 * PostHog automatically captures country information from IP geolocation
 */
export async function getCountryFromPostHog(): Promise<{ code: string; name: string } | null> {
  if (typeof window === 'undefined' || !posthog) {
    return null;
  }

  try {
    // PostHog automatically adds $geoip_country_code to person properties
    // We can get it from getPersonProperties or from the last event
    const personProperties = posthog.getPersonProperties();
    
    // Check for country code in person properties
    // PostHog uses $geoip_country_code for country code
    const countryCode = personProperties?.$geoip_country_code || 
                       personProperties?.country_code ||
                       personProperties?.country;
    
    // Get country name if available
    const countryName = personProperties?.$geoip_country_name ||
                       personProperties?.country_name ||
                       personProperties?.country;

    if (countryCode) {
      return {
        code: String(countryCode).toUpperCase(),
        name: countryName ? String(countryName) : countryCode
      };
    }

    // If not in person properties, try to get from session storage or use a fallback
    // PostHog might not have identified the person yet, so we can check the last event
    // For now, return null if not available - the API will handle it
    return null;
  } catch (error) {
    console.warn('[getCountryFromPostHog] Failed to get country from PostHog:', error);
    return null;
  }
}

/**
 * Send notification email if user is not from Israel
 */
export async function notifyNonIsraelSignupModal(
  countryCode: string,
  countryName: string,
  trigger: string,
  fileCount?: number
): Promise<void> {
  if (!countryCode || countryCode === 'IL') {
    return; // Don't notify for Israel
  }

  try {
    const API_URL = import.meta.env.DEV 
      ? 'http://localhost:3001/api/notify-signup-modal'
      : '/api/notify-signup-modal';
    
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode,
        countryName,
        trigger,
        fileCount
      })
    });
  } catch (error) {
    // Silently fail - notification failure shouldn't break the flow
    console.warn('[notifyNonIsraelSignupModal] Failed to send notification:', error);
  }
}

