import { posthog } from '@/lib/posthog';

// Helper to safely capture events (checks if PostHog is loaded)
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('[PostHog] 📊 Event:', eventName, properties || {});
    }
    posthog.capture(eventName, properties);
  } else if (import.meta.env.DEV) {
    console.warn('[PostHog] ⚠️ PostHog not available. Event not tracked:', eventName);
  }
};

// Pre-defined event names for consistency
export const Events = {
  // File Upload Events
  FILE_UPLOADED: 'file_uploaded',
  FILE_REMOVED: 'file_removed',
  FILES_CLEARED: 'files_cleared',
  FILE_DROP: 'file_dropped',
  
  // Extraction Events
  EXTRACTION_STARTED: 'extraction_started',
  EXTRACTION_COMPLETED: 'extraction_completed',
  EXTRACTION_FAILED: 'extraction_failed',
  EXTRACTION_FILE_PROCESSED: 'extraction_file_processed',
  
  // Results Events
  CSV_DOWNLOADED: 'csv_downloaded',
  ROW_EXPANDED: 'row_expanded',
  ROW_COLLAPSED: 'row_collapsed',
  FILTER_FLAGGED_TOGGLED: 'filter_flagged_toggled',
  RECEIPT_IMAGE_VIEWED: 'receipt_image_viewed',
  RECEIPT_DATA_COPIED: 'receipt_data_copied',
  
  // Examples Events
  EXAMPLES_MODAL_OPENED: 'examples_modal_opened',
  EXAMPLES_MODAL_CLOSED: 'examples_modal_closed',
  EXAMPLES_LOADED: 'examples_loaded',
  EXAMPLE_PREVIEWED: 'example_previewed',
  
  // Authentication Events
  LOGIN_MODAL_OPENED: 'login_modal_opened',
  LOGIN_ATTEMPTED: 'login_attempted',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  SIGNUP_ATTEMPTED: 'signup_attempted',
  SIGNUP_SUCCESS: 'signup_success',
  SIGNUP_FAILED: 'signup_failed',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_UP: 'user_signed_up',
  LOGOUT: 'logout',
  AUTH_STATE_CHANGED: 'auth_state_changed',
  
  // Send CSV Events
  SEND_CSV_BUTTON_CLICKED: 'send_csv_button_clicked',
  SEND_CSV_MODAL_OPENED: 'send_csv_modal_opened',
  SEND_CSV_ATTEMPTED: 'send_csv_attempted',
  SEND_CSV_SUCCESS: 'send_csv_success',
  SEND_CSV_FAILED: 'send_csv_failed',
  
  // HubSpot Form Events
  LEAD_FORM_SUBMITTED: 'lead_form_submitted',
  LEAD_FORM_SUCCESS: 'lead_form_success',
  LEAD_FORM_FAILED: 'lead_form_failed',
  
  // PDF Processing Events
  PDF_CONVERTED: 'pdf_converted',
  PDF_CONVERSION_FAILED: 'pdf_conversion_failed',
  IMAGE_COMPRESSED: 'image_compressed',
  
  // Duplicate Detection Events
  DUPLICATES_DETECTED: 'duplicates_detected',
  
  // Error Events
  ERROR_OCCURRED: 'error_occurred',
} as const;

// Error tracking helper
export const trackError = (error: Error | string, context?: Record<string, any>) => {
  const errorMessage = error instanceof Error ? error.message : error;
  trackEvent(Events.ERROR_OCCURRED, {
    error_message: errorMessage,
    error_type: error instanceof Error ? error.constructor.name : 'string',
    ...context
  });
};
