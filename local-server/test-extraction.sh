#!/bin/bash

echo "🧾 Testing Updated Receipt Extraction..."
echo ""

# Test 1: Simple text file
echo "📄 Test 1: Text file"
curl -s -X POST http://localhost:3001/api/extract-receipts -F "files=@test-receipt.txt" | jq -r '.csv'
echo ""

# Test 2: Health check
echo "🏥 Test 2: Health check"
curl -s http://localhost:3001/api/health | jq
echo ""

echo "✅ Tests completed!"
echo ""
echo "🌐 Access points:"
echo "   - Server: http://localhost:3001"
echo "   - Health: http://localhost:3001/api/health"
echo "   - Test UI: Open test.html in browser"
echo ""
echo "📊 New schema: Invoice Number,Date,Amount,Currency,Merchant,Transaction Type"
