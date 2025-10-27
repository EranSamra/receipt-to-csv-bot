#!/bin/bash

echo "🚀 Deploying Receipt Data Extractor to Vercel"
echo "=============================================="

echo "1. Checking if Vercel CLI is available..."
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

echo "2. Logging into Vercel..."
vercel login

echo "3. Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Next steps:"
echo "1. Go to your Vercel dashboard"
echo "2. Set environment variable: GEMINI_API_KEY"
echo "3. Test on mobile device"
echo ""
echo "🔗 Your app will be available at: https://[project-name].vercel.app"
