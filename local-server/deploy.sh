#!/bin/bash

# Receipt Data Extractor - Quick Deploy Script
# This script helps you deploy to Railway with minimal setup

echo "🚀 Receipt Data Extractor - Cloud Deployment"
echo "============================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo "🔐 Logging into Railway..."
railway login

echo "🚂 Initializing Railway project..."
railway init

echo "🔧 Setting environment variables..."
railway variables set GEMINI_API_KEY=AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY
railway variables set NODE_ENV=production

echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your app will be available at: https://your-app-name.railway.app"
echo ""
echo "📋 Next steps:"
echo "1. Wait for deployment to complete (2-3 minutes)"
echo "2. Visit your Railway dashboard to get the live URL"
echo "3. Test the app with some receipt files"
echo "4. Share the URL with your team!"
