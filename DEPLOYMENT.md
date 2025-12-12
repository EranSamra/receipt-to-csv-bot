# Receipt Data Extractor - Vercel Deployment

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Gemini API Key**: Get your API key from [Google AI Studio](                                      https://makersuite.google.com/app/apikey)

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
# Login to Vercel
npx vercel login

# Deploy
npm run deploy
```

#### Option B: Using Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will automatically detect it's a Vite project

### 3. Configure Environment Variables

**📋 See [VERCEL_ENV_VARIABLES.md](./VERCEL_ENV_VARIABLES.md) for a complete list of all environment variables.**

**Minimum Required Variables:**
- `GEMINI_API_KEY` - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- `RESEND_API_KEY` - Get from [Resend.com](https://resend.com/api-keys) (for email features)
- `EMAIL_FROM` - Email sender address (e.g., `Mesh AI <onboarding@resend.dev>`)
- `VITE_SUPABASE_URL` - Your Supabase project URL (if using Supabase auth)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon key (if using Supabase auth)

**To add variables in Vercel:**
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable listed above
4. Select environments (Production, Preview, Development)
5. Click Save

### 4. Redeploy

After adding environment variables, redeploy your project:
```bash
npm run deploy
```

## Project Structure

```
├── api/
│   └── extract-receipts.js    # Vercel API route for receipt processing
├── src/
│   ├── pages/
│   │   └── Index.tsx          # Main React component
│   └── components/
│       ├── ReceiptUpload.tsx  # File upload component
│       └── ResultsTable.tsx   # Results display component
├── vercel.json                # Vercel configuration
└── package.json               # Dependencies and scripts
```

## Features

- ✅ **Up to 30 receipts** per upload
- ✅ **Invoice Number sharing** across multiple rows from same file
- ✅ **Mesh-aligned UI** with professional styling
- ✅ **CSV export** with proper schema
- ✅ **Real-time processing** with progress indicators

## API Endpoint

The deployed app will have an API endpoint at:
```
https://your-project.vercel.app/api/extract-receipts
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   - Make sure `GEMINI_API_KEY` is set in Vercel dashboard
   - Redeploy after adding environment variables

2. **File Upload Errors**
   - Check file size limits (1MB per file, 30 files max)
   - Ensure files are JPG, PNG, or PDF format

3. **API Timeout**
   - Vercel has a 60-second timeout for API routes
   - Large batches may need to be split into smaller groups

### Support

For issues with deployment, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
