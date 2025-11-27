# PostHog Event Tracking - Testing Guide

## Overview
This document outlines how to test all PostHog event tracking implementations.

## Prerequisites
1. Start the development server: `npm run dev`
2. Open browser DevTools Console
3. Open PostHog dashboard (or check Network tab for PostHog API calls)

## Testing Checklist

### 1. File Upload Events

#### Test: File Upload via Input
- [ ] Click "Upload your receipts" area
- [ ] Select one or more image files
- **Expected Event:** `file_uploaded` with properties:
  - `file_count`: number of files
  - `file_types`: array of file types
  - `method`: "file_input"

#### Test: File Drop
- [ ] Drag and drop files onto upload area
- **Expected Event:** `file_dropped` with properties:
  - `file_count`: number of files
  - `file_types`: array of file types

#### Test: Remove File
- [ ] Upload files
- [ ] Click X button on a file
- **Expected Event:** `file_removed` with properties:
  - `file_name`: name of removed file
  - `remaining_files`: count after removal

#### Test: Clear All Files
- [ ] Upload multiple files
- [ ] Click "Clear All" button
- **Expected Event:** `files_cleared` with properties:
  - `file_count`: number of files cleared

---

### 2. Extraction Events

#### Test: Start Extraction
- [ ] Upload files
- [ ] Click "Extract Data" button
- **Expected Event:** `extraction_started` with properties:
  - `file_count`: number of files
  - `file_types`: array of file types
  - `total_size_mb`: total size in MB

#### Test: Extraction Completion
- [ ] Complete extraction successfully
- **Expected Event:** `extraction_completed` with properties:
  - `receipt_count`: number of receipts extracted
  - `file_count`: number of files processed
  - `success`: true

#### Test: Extraction Failure
- [ ] Upload invalid/corrupted file
- [ ] Trigger extraction error
- **Expected Event:** `extraction_failed` with properties:
  - `error`: error message
  - `file_count`: number of files

#### Test: PDF Conversion
- [ ] Upload a PDF file
- **Expected Event:** `pdf_converted` with properties:
  - `file_name`: PDF filename
  - `file_size_kb`: original size
  - `converted_size_kb`: converted size

#### Test: Image Compression
- [ ] Upload large image (>1MB)
- **Expected Event:** `image_compressed` with properties:
  - `file_name`: image filename
  - `original_size_mb`: original size
  - `compressed_size_mb`: compressed size
  - `compression_ratio`: percentage

#### Test: Duplicate Detection
- [ ] Upload duplicate receipts
- **Expected Event:** `duplicates_detected` with properties:
  - `duplicate_count`: number of duplicates
  - `total_receipts`: total receipts

---

### 3. Results Table Events

#### Test: Expand Row
- [ ] Click chevron to expand row with line items
- **Expected Event:** `row_expanded` with properties:
  - `row_index`: row number
  - `has_line_items`: boolean
  - `line_item_count`: number of line items

#### Test: Collapse Row
- [ ] Click chevron to collapse expanded row
- **Expected Event:** `row_collapsed` with properties:
  - `row_index`: row number
  - `has_line_items`: boolean
  - `line_item_count`: number of line items

#### Test: Filter Toggle
- [ ] Click "Flagged Only" / "Show All" button
- **Expected Event:** `filter_flagged_toggled` with properties:
  - `show_flagged_only`: boolean
  - `total_receipts`: total count
  - `flagged_count`: flagged count

#### Test: View Receipt Image
- [ ] Click on receipt thumbnail/image
- **Expected Event:** `receipt_image_viewed` with properties:
  - `invoice_number`: invoice number
  - `view_type`: "mobile" or undefined (desktop)

#### Test: Download CSV
- [ ] Click "CSV Downloaded" button (if exists) or download CSV
- **Expected Event:** `csv_downloaded` with properties:
  - `receipt_count`: number of receipts

---

### 4. Examples Modal Events

#### Test: Open Examples Modal
- [ ] Click "Try Examples" or similar button
- **Expected Event:** `examples_modal_opened`

#### Test: Close Examples Modal
- [ ] Open examples modal
- [ ] Click outside or close button
- **Expected Event:** `examples_modal_closed`

#### Test: Preview Example
- [ ] Open examples modal
- [ ] Click on an example receipt thumbnail
- **Expected Event:** `example_previewed` with properties:
  - `receipt_id`: example ID
  - `receipt_name`: example name

#### Test: Load Examples
- [ ] Select examples
- [ ] Click "Extract Data" in examples modal
- **Expected Event:** `examples_loaded` with properties:
  - `example_count`: number of examples
  - `receipt_ids`: array of selected IDs

---

### 5. Authentication Events

#### Test: Open Login Modal
- [ ] Try to extract without being logged in
- **Expected Event:** `login_modal_opened` with properties:
  - `trigger`: "extraction_required"

#### Test: Login Attempt
- [ ] Enter credentials and submit
- **Expected Event:** `login_attempted` with properties:
  - `email_domain`: email domain
  - `is_business_email`: boolean

#### Test: Login Success
- [ ] Successfully log in
- **Expected Event:** `login_success` with properties:
  - `email_domain`: email domain

#### Test: Login Failure
- [ ] Enter wrong credentials
- **Expected Event:** `login_failed` with properties:
  - `error_message`: error message
  - `email_domain`: email domain

#### Test: Signup Attempt
- [ ] Switch to signup mode
- [ ] Submit signup form
- **Expected Event:** `signup_attempted` with properties:
  - `email_domain`: email domain
  - `is_business_email`: boolean

#### Test: Signup Success/Failure
- [ ] Complete signup or trigger error
- **Expected Event:** `signup_success` or `signup_failed`

#### Test: Logout
- [ ] Click logout button
- **Expected Event:** `logout`

#### Test: Auth State Change
- [ ] Login/logout (automatic)
- **Expected Event:** `auth_state_changed` with properties:
  - `event_type`: "SIGNED_IN", "SIGNED_OUT", etc.
  - `has_session`: boolean
  - `user_id`: user ID if logged in

---

### 6. Send CSV Modal Events

#### Test: Open Send CSV Modal
- [ ] After extraction, click "Send CSV to my work email"
- **Expected Event:** `send_csv_modal_opened` with properties:
  - `receipt_count`: number of receipts

#### Test: Send CSV Attempt
- [ ] Enter email and submit
- **Expected Event:** `send_csv_attempted` with properties:
  - `email`: email address
  - `receipt_count`: number of receipts

#### Test: Send CSV Success
- [ ] Successfully send CSV
- **Expected Event:** `send_csv_success` with properties:
  - `receipt_count`: number of receipts

#### Test: Send CSV Failure
- [ ] Trigger send error (invalid email, network error)
- **Expected Event:** `send_csv_failed` with properties:
  - `error`: error message
  - `status`: HTTP status (if applicable)

---

### 7. Lead Form Events (MeshHeroCTA)

#### Test: Submit Lead Form
- [ ] Scroll to bottom of page
- [ ] Fill and submit lead capture form
- **Expected Event:** `lead_form_submitted` with properties:
  - `email_domain`: email domain
  - `has_company`: boolean

#### Test: Lead Form Success
- [ ] Successfully submit form
- **Expected Event:** `lead_form_success` with properties:
  - `email_domain`: email domain

#### Test: Lead Form Failure
- [ ] Trigger form error
- **Expected Event:** `lead_form_failed` with properties:
  - `error`: error message

---

### 8. Error Events

#### Test: Error Tracking
- [ ] Trigger any error in the application
- **Expected Event:** `error_occurred` with properties:
  - `error_message`: error message
  - `error_type`: error type
  - Additional context properties

---

## How to Verify Events in PostHog

### Method 1: Browser DevTools
1. Open DevTools → Network tab
2. Filter by "posthog" or "us.i.posthog.com"
3. Look for POST requests to `/e/` endpoint
4. Check request payload for event names and properties

### Method 2: PostHog Dashboard
1. Go to your PostHog dashboard
2. Navigate to "Events" or "Live events"
3. Filter by event name
4. View event properties

### Method 3: Console Logging (Development)
Add this to `posthogEvents.ts` for debugging:
```typescript
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog) {
    console.log('[PostHog] Tracking event:', eventName, properties);
    posthog.capture(eventName, properties);
  }
};
```

## Quick Test Script

Run this in browser console to test PostHog connection:
```javascript
// Check if PostHog is loaded
console.log('PostHog loaded:', typeof posthog !== 'undefined');

// Test event capture
if (typeof posthog !== 'undefined') {
  posthog.capture('test_event', { test: true });
  console.log('Test event sent!');
}
```

## Common Issues

1. **Events not appearing**: Check if PostHog is initialized (check console for "[PostHog] Analytics initialized")
2. **Missing properties**: Verify properties are being passed correctly
3. **Events firing multiple times**: Check for duplicate event handlers
4. **Type errors**: Ensure all imports are correct

## Notes

- All events are automatically captured by PostHog autocapture (clicks, page views)
- Custom events use explicit `trackEvent()` calls
- Events include relevant context for analysis
- Error tracking captures both explicit errors and unexpected failures

