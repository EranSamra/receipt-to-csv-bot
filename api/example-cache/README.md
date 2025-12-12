# Example Receipt Cache

This directory contains pre-processed cache files for example receipts.

## Purpose

Example receipts should never call the Gemini API. Instead, they use pre-populated cache files stored here. These files are committed to the repository so they persist across Vercel deployments.

## Populating the Cache

To populate or update the cache files, run:

```bash
GEMINI_API_KEY=your_key node api/populate-example-cache.js
```

This script will:
1. Process all example receipts from `public/sample-receipts/`
2. Call the Gemini API to extract data
3. Save the results as JSON files in this directory

## Cache File Format

Each cache file is named `example-{normalized-filename}.json` and contains:

```json
{
  "timestamp": 1234567890,
  "filename": "fake-receipt.png",
  "data": {
    "csv": "invoice,date,amount,...",
    "lineItems": [...]
  }
}
```

## Notes

- Cache files are committed to git
- The cache system checks this directory first, then falls back to `/tmp` (ephemeral)
- If cache is missing, examples will show an error instead of calling the API

