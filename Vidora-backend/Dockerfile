FROM node:20-slim

# Install FFmpeg (node:20-slim uses Debian, so we use apt-get)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (only production deps)
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create tmp directories for workers
RUN mkdir -p tmp_video_processing tmp_ai_processing

# Production defaults
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"

# Expose main API port
EXPOSE 8000

# Default command
CMD ["npm", "start"]
