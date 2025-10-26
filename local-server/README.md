# 🧾 Receipt Scanner (Local Version)

A local, cloud-free version of the receipt scanner that runs entirely on your machine using Express.js and Gemini 2.0 AI.

## ✨ Features

- **Local Processing**: No cloud dependencies, everything runs on your machine
- **Gemini 2.0 AI**: Uses the latest Gemini 2.0 Flash model for accurate extraction
- **Multi-language Support**: Handles Hebrew, English, and other languages
- **Multiple Receipt Types**: Retail receipts, hotel invoices, digital receipts
- **Batch Processing**: Upload up to 5 receipts at once
- **CSV Export**: Download extracted data as CSV files
- **Real-time Progress**: Visual progress indicators during processing

## 🚀 Quick Start

### 1. Setup
```bash
# Run the setup script
./setup-local.sh

# Install dependencies
cd local-server
npm install
```

### 2. Start the Server
```bash
# Start the local server
npm start
```

The server will start on `http://localhost:3001`

### 3. Test the Application

**Option A: Simple HTML Client**
Open `local-server/test.html` in your browser for a simple interface.

**Option B: Full React Client** (if you have the React setup)
```bash
# In another terminal
cd local-server/client
npm install
npm run dev
```

## 🔧 Configuration

The Gemini API key is already configured in the server code. If you need to change it:

1. Edit `local-server/server.js`
2. Update the `GEMINI_API_KEY` variable
3. Restart the server

## 📡 API Endpoints

### Health Check
```
GET http://localhost:3001/api/health
```
Returns server status and configuration info.

### Extract Receipts
```
POST http://localhost:3001/api/extract-receipts
Content-Type: multipart/form-data
Body: files (up to 5 files, max 1MB each)
```

**Response:**
```json
{
  "csv": "source_filename,is_receipt,total_amount,vat_amount,currency_ISO_4217,merchant_name_localized,date_ISO_8601,is_month_explicit,receipt_id,merchant_address,document_language_ISO_639,all_totals,all_dates,spend_category\nreceipt1.jpg,true,25.50,4.25,USD,Store Name,2024-01-15,true,R123,123 Main St,en,25.50,2024-01-15,food"
}
```

## 🧪 Testing

### Test with curl
```bash
# Test with a text file
curl -X POST http://localhost:3001/api/extract-receipts \
  -F "files=@test-receipt.txt"

# Test with an image (if you have one)
curl -X POST http://localhost:3001/api/extract-receipts \
  -F "files=@receipt.jpg"
```

### Test with the HTML client
1. Open `local-server/test.html` in your browser
2. Upload receipt images
3. Click "Extract Data"
4. Download the CSV results

## 📊 Extracted Data Fields

| Field | Description |
|-------|-------------|
| `source_filename` | Original filename |
| `is_receipt` | Whether the document is a receipt |
| `total_amount` | Total amount paid |
| `vat_amount` | VAT/tax amount |
| `currency_ISO_4217` | Currency code (USD, EUR, etc.) |
| `merchant_name_localized` | Store/merchant name |
| `date_ISO_8601` | Transaction date |
| `is_month_explicit` | Whether month is explicitly stated |
| `receipt_id` | Receipt/transaction ID |
| `merchant_address` | Store address |
| `document_language_ISO_639` | Language code (en, he, etc.) |
| `all_totals` | All monetary amounts found |
| `all_dates` | All dates found |
| `spend_category` | Category (food, lodging, other) |

## 🔍 Troubleshooting

### Server won't start
- Check if port 3001 is available
- Ensure Node.js is installed
- Run `npm install` in the `local-server` directory

### API errors
- Check the server logs in the terminal
- Verify the Gemini API key is valid
- Ensure files are under 1MB each

### No data extracted
- Check if the image is clear and readable
- Try with different receipt formats
- Check server logs for AI processing errors

## 🎯 Advantages of Local Version

1. **Privacy**: All processing happens on your machine
2. **Speed**: No network latency to cloud services
3. **Reliability**: No dependency on external services
4. **Cost**: No cloud processing costs
5. **Offline**: Works without internet (except for AI processing)

## 🔄 Migration from Supabase Version

If you were using the Supabase version:

1. **No more 500 errors**: Local processing eliminates cloud function issues
2. **No more stack overflow**: Optimized base64 encoding prevents memory issues
3. **Better debugging**: Full access to server logs
4. **Faster development**: No deployment needed for testing

## 📝 Notes

- The server uses Express.js with multer for file handling
- Base64 encoding is optimized to prevent memory issues
- Files are processed sequentially to avoid overwhelming the AI API
- The Gemini API key is embedded for convenience (change if needed)

## 🚀 Next Steps

1. **Test with real receipts**: Upload actual receipt images
2. **Customize extraction**: Modify the AI prompt in `server.js`
3. **Add features**: Implement additional data fields or processing
4. **Deploy**: Consider deploying to a VPS for team access

---

**Ready to scan receipts locally!** 🎉
