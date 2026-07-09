FROM node:20-alpine

# Install FFmpeg which is required for the video and AI workers
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (only production deps)
RUN npm ci --only=production

# Copy application source code
COPY . .

# Create tmp directories for workers
RUN mkdir -p tmp_video_processing tmp_ai_processing

# Restrict Node.js memory to prevent OOM on 512MB Free Tier (leaves room for FFmpeg)
ENV NODE_OPTIONS="--max-old-space-size=256"

# Expose main API port
EXPOSE 8000

# Default command (can be overridden by docker-compose for workers)
CMD ["npm", "start"]
