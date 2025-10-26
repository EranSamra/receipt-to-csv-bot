# Receipt Data Extractor - Cloud Deployment

## 🚀 Quick Deploy to Railway

### Option 1: Deploy via Railway Dashboard (Recommended)

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login** with GitHub
3. **Click "New Project"** → **"Deploy from GitHub repo"**
4. **Connect your GitHub account** and select this repository
5. **Select the `local-server` folder** as the root directory
6. **Add Environment Variable:**
   - Key: `GEMINI_API_KEY`
   - Value: `AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY`
7. **Click "Deploy"**

### Option 2: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Set environment variable
railway variables set GEMINI_API_KEY=AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY

# Deploy
railway up
```

## 🌐 Alternative Cloud Platforms

### Render.com
1. Connect GitHub repository
2. Select "Web Service"
3. Root directory: `local-server`
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variable: `GEMINI_API_KEY`

### Heroku
1. Create new Heroku app
2. Connect GitHub repository
3. Set buildpack: `heroku/nodejs`
4. Add config var: `GEMINI_API_KEY`
5. Deploy from main branch

### Vercel
1. Import GitHub repository
2. Framework: Other
3. Root directory: `local-server`
4. Build command: `npm install`
5. Output directory: `.`
6. Add environment variable: `GEMINI_API_KEY`

## 📋 Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `GEMINI_API_KEY` | `AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY` | Google Gemini API key |
| `NODE_ENV` | `production` | Environment mode (optional) |
| `PORT` | Auto-assigned | Server port (auto-set by platform) |

## 🔧 Features

- ✅ **AI-Powered Extraction**: Uses Gemini 2.0 Flash for accurate data extraction
- ✅ **Batch Processing**: Handle up to 30 receipts at once
- ✅ **Multiple Items**: Supports multiple items per invoice with shared invoice numbers
- ✅ **CSV Export**: Download extracted data as CSV
- ✅ **File Validation**: Supports JPG, PNG, PDF (max 1MB each)
- ✅ **Rate Limiting**: Respects API limits with batch processing
- ✅ **Error Handling**: Comprehensive error handling and user feedback

## 📊 API Endpoints

- `GET /` - Web interface
- `GET /api/health` - Health check
- `POST /api/extract-receipts` - Extract receipt data

## 🎯 Usage

1. **Upload Receipts**: Drag & drop or click to upload up to 30 receipt files
2. **Extract Data**: Click "Extract Data" to process with AI
3. **Download CSV**: Download the structured data as CSV file

## 📈 Schema

The extracted CSV follows this schema:
```csv
Invoice Number,Date,Amount,Currency,Merchant,Transaction Type
```

## 🔒 Security

- Files are processed in memory (not stored)
- API key is environment-protected
- CORS configured for production
- File size and count limits enforced
