/**
 * Centralized config — single source of truth for all env vars.
 * Import from here instead of touching process.env directly in controllers.
 */
export const config = {
  port: parseInt(process.env.PORT, 10) || 8000,
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  mongo: {
    uri: process.env.MONGODB_URI,
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  auth: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "15m",
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    // maxAge in ms for cookies
    accessTokenMaxAge: 15 * 60 * 1000,           // 15 minutes
    refreshTokenMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  meilisearch: {
    host: process.env.MEILI_HOST || "http://localhost:7700",
    apiKey: process.env.MEILI_MASTER_KEY || "",
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    baseUrl: "https://api.groq.com/openai/v1",
    whisperModel: "whisper-large-v3-turbo",
    chatModel: "llama-3.3-70b-versatile",
    embeddingModel: "text-embedding-3-small",
  },

  qdrant: {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY || "",
    collectionName: "vidora-transcripts",
  },
};
