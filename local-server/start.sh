#!/bin/bash

echo "🧾 Starting Local Receipt Scanner..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to local-server directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🚀 Starting server on http://localhost:3001"
echo "📊 Health check: http://localhost:3001/api/health"
echo "🧪 Test client: Open test.html in your browser"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
