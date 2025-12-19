# Railway Deployment Dockerfile for GaiaLab
# Explicitly configured to use environment variables at runtime only (not build time)

FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
# Note: No environment variables needed during build - all loaded at runtime
RUN npm install --omit=dev

# Copy application source
COPY . .

# Expose port (will be overridden by Railway's PORT variable)
EXPOSE 8787

# Start the server
# Environment variables (API keys) are loaded at runtime via process.env
CMD ["npm", "start"]
