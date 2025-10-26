#!/bin/bash

echo "🚀 Setting up Local Receipt Scanner..."

# Create client directory structure
mkdir -p local-server/client/src/pages
mkdir -p local-server/client/src/components
mkdir -p local-server/client/src/components/ui
mkdir -p local-server/client/src/hooks
mkdir -p local-server/client/src/utils

# Copy necessary files from main project
echo "📁 Copying client files..."

# Copy components
cp -r src/components/* local-server/client/src/components/ 2>/dev/null || echo "Components directory not found, will create manually"

# Copy hooks
cp -r src/hooks/* local-server/client/src/hooks/ 2>/dev/null || echo "Hooks directory not found, will create manually"

# Copy utils
cp -r src/utils/* local-server/client/src/utils/ 2>/dev/null || echo "Utils directory not found, will create manually"

# Copy config files
cp package.json local-server/client/ 2>/dev/null || echo "Package.json not found"
cp vite.config.ts local-server/client/ 2>/dev/null || echo "Vite config not found"
cp tailwind.config.ts local-server/client/ 2>/dev/null || echo "Tailwind config not found"
cp tsconfig.json local-server/client/ 2>/dev/null || echo "TSConfig not found"

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. cd local-server"
echo "2. npm install"
echo "3. npm run dev"
echo ""
echo "🌐 The app will be available at:"
echo "   - Frontend: http://localhost:5173"
echo "   - Backend: http://localhost:3001"
echo "   - Health check: http://localhost:3001/api/health"
