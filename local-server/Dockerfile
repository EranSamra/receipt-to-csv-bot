# Google Cloud Run Deployment Configuration

# Dockerfile for Google Cloud Run
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
