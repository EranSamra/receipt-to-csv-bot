# Google Cloud Deployment Script
#!/bin/bash

# Receipt Data Extractor - Google Cloud Run Deployment
# This script deploys your app to Google Cloud Run

echo "🚀 Receipt Data Extractor - Google Cloud Deployment"
echo "=================================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set variables
PROJECT_ID="your-project-id"  # Replace with your actual project ID
SERVICE_NAME="receipt-data-extractor"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Service Name: $SERVICE_NAME"
echo "   Region: $REGION"
echo "   Image: $IMAGE_NAME"
echo ""

# Set the project
echo "🔧 Setting Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and push the container
echo "🏗️ Building and pushing container..."
gcloud builds submit --tag $IMAGE_NAME .

# Create secret for API key
echo "🔐 Creating secret for Gemini API key..."
echo "Please enter your Gemini API key:"
read -s GEMINI_API_KEY
echo $GEMINI_API_KEY | gcloud secrets create gemini-api-key --data-file=-

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production \
    --set-secrets GEMINI_API_KEY=gemini-api-key:latest

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your app is available at: $SERVICE_URL"
echo ""
echo "📋 Next steps:"
echo "1. Test the app with some receipt files"
echo "2. Share the URL with your team"
echo "3. Monitor usage in Google Cloud Console"
echo ""
echo "🔧 To update the app:"
echo "   Run this script again after making changes"
