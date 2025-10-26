#!/bin/bash

echo "🧪 Testing Local Development Setup"
echo "=================================="

echo "1. Testing Local Server (Port 3001)..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Local server is running"
else
    echo "❌ Local server is not running"
    exit 1
fi

echo ""
echo "2. Testing React Dev Server (Port 8080)..."
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ React dev server is running"
else
    echo "❌ React dev server is not running"
    exit 1
fi

echo ""
echo "3. Testing Receipt Extraction..."
response=$(curl -s -X POST http://localhost:3001/api/extract-receipts -F "files=@test-invoice.txt")
if echo "$response" | grep -q "Invoice Number"; then
    echo "✅ Receipt extraction is working"
    echo "   Sample output: $(echo "$response" | head -c 100)..."
else
    echo "❌ Receipt extraction failed"
    echo "   Response: $response"
    exit 1
fi

echo ""
echo "🎉 Local development setup is working perfectly!"
echo ""
echo "📱 React App: http://localhost:8080"
echo "🔧 API Server: http://localhost:3001"
echo ""
echo "You can now:"
echo "- Open http://localhost:8080 in your browser"
echo "- Upload receipts and test the full workflow"
echo "- Make changes to the code and see them hot-reload"
