import Redis from "ioredis";
import { logger } from "../utils/logger.js";

/**
 * Redis connection for BullMQ queues.
 * Falls back to localhost:6379 if REDIS_URL is not set.
 * Connection is lazy — BullMQ creates its own connections from this config.
 */
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
};

/**
 * Shared Redis connection for non-queue use (caching, etc.)
 * BullMQ manages its own connections internally.
 */
let redisClient = null;

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);

    redisClient.on("connect", () => {
      logger.info("Redis connected");
    });

    redisClient.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });
  }
  return redisClient;
};

export { redisConfig };
