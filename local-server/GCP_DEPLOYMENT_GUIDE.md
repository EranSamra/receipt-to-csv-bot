# 🚀 **Google Cloud Platform Deployment Guide**

## ✅ **Why Google Cloud?**

- **Native Integration**: Perfect for Gemini API (same ecosystem)
- **Serverless**: Cloud Run scales automatically
- **Cost Effective**: Pay only for what you use
- **Global CDN**: Fast worldwide access
- **Enterprise Grade**: Production-ready infrastructure

## 🎯 **Deployment Options**

### **Option 1: Google Cloud Run (Recommended)**

**Best for**: Serverless, auto-scaling, cost-effective

1. **Setup Google Cloud Project**
   ```bash
   # Install Google Cloud CLI
   # https://cloud.google.com/sdk/docs/install
   
   # Login and set project
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Deploy with Script**
   ```bash
   cd local-server
   ./deploy-gcp.sh
   ```

3. **Manual Deployment**
   ```bash
   # Build and push container
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/receipt-extractor .
   
   # Deploy to Cloud Run
   gcloud run deploy receipt-extractor \
       --image gcr.io/YOUR_PROJECT_ID/receipt-extractor \
       --platform managed \
       --region us-central1 \
       --allow-unauthenticated \
       --port 8080 \
       --memory 2Gi \
       --cpu 2
   ```

### **Option 2: Google App Engine**

**Best for**: Traditional web apps, managed platform

1. **Create app.yaml**
   ```yaml
   runtime: nodejs18
   service: receipt-extractor
   
   env_variables:
     NODE_ENV: production
     GEMINI_API_KEY: "AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY"
   
   automatic_scaling:
     min_instances: 1
     max_instances: 10
   
   resources:
     cpu: 2
     memory_gb: 2
   ```

2. **Deploy**
   ```bash
   gcloud app deploy
   ```

### **Option 3: Google Kubernetes Engine (GKE)**

**Best for**: Complex applications, microservices

1. **Create cluster**
   ```bash
   gcloud container clusters create receipt-cluster \
       --zone us-central1-a \
       --num-nodes 3
   ```

2. **Deploy with kubectl**
   ```bash
   kubectl apply -f cloud-run-service.yaml
   ```

## 🔧 **Configuration Files Created**

- ✅ `Dockerfile` - Container configuration
- ✅ `cloud-run-service.yaml` - Kubernetes/Cloud Run service
- ✅ `deploy-gcp.sh` - Automated deployment script

## 💰 **Pricing Estimate**

**Cloud Run (Recommended)**:
- **Free Tier**: 2 million requests/month
- **After Free**: ~$0.40 per million requests
- **CPU/Memory**: ~$0.00002400 per vCPU-second
- **Estimated Cost**: $0-5/month for typical usage

**App Engine**:
- **Free Tier**: 28 instance-hours/day
- **After Free**: ~$0.05 per instance-hour
- **Estimated Cost**: $0-10/month for typical usage

## 🌐 **After Deployment**

You'll get a URL like:
- **Cloud Run**: `https://receipt-extractor-xxx-uc.a.run.app`
- **App Engine**: `https://YOUR_PROJECT_ID.appspot.com`
- **GKE**: `https://your-ingress-ip`

## 🔐 **Security Features**

- ✅ **HTTPS by default**
- ✅ **IAM authentication**
- ✅ **Secret management**
- ✅ **VPC networking**
- ✅ **DDoS protection**

## 📊 **Monitoring & Logging**

- **Cloud Monitoring**: Real-time metrics
- **Cloud Logging**: Centralized logs
- **Error Reporting**: Automatic error tracking
- **Performance Insights**: Optimization recommendations

## 🚀 **Quick Start**

1. **Create Google Cloud Project**
2. **Enable billing** (required for Cloud Run)
3. **Run deployment script**:
   ```bash
   cd local-server
   ./deploy-gcp.sh
   ```
4. **Get your live URL**
5. **Share with your team!**

## 🎯 **Benefits of Google Cloud**

- **Same ecosystem** as Gemini API
- **Automatic scaling** based on traffic
- **Global infrastructure** for fast access
- **Enterprise security** and compliance
- **Pay-per-use** pricing model
- **Built-in monitoring** and logging

**Ready to deploy to Google Cloud? It's the perfect platform for your Gemini-powered app!**
